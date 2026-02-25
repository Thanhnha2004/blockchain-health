import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { DIDRegistry } from "../typechain-types/contracts/DIDRegistry";
import { DIDRegistry__factory } from "../typechain-types/factories/contracts/DIDRegistry__factory";
import { HealthAccessControl } from "../typechain-types/contracts/HealthAccessControl";
import { HealthAccessControl__factory } from "../typechain-types/factories/contracts/HealthAccessControl__factory";
import { AuditLog } from "../typechain-types/contracts/AuditLog";
import { AuditLog__factory } from "../typechain-types/factories/contracts/AuditLog__factory";
import { RecordRegistry } from "../typechain-types/contracts/RecordRegistry";
import { RecordRegistry__factory } from "../typechain-types/factories/contracts/RecordRegistry__factory";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeDID = (str: string) => ethers.keccak256(ethers.toUtf8Bytes(str));
const PROVIDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROVIDER_ROLE"));

async function deployAll(admin: SignerWithAddress) {
  const didRegistry = await new DIDRegistry__factory(admin).deploy();
  await didRegistry.waitForDeployment();

  const auditLog = await new AuditLog__factory(admin).deploy();
  await auditLog.waitForDeployment();

  const accessControl = await new HealthAccessControl__factory(admin).deploy();
  await accessControl.waitForDeployment();

  const recordRegistry = await new RecordRegistry__factory(admin).deploy(
    await accessControl.getAddress(),
    await auditLog.getAddress(),
  );
  await recordRegistry.waitForDeployment();

  // Whitelist RecordRegistry trong AuditLog
  await auditLog
    .connect(admin)
    .addAuthorizedContract(await recordRegistry.getAddress());

  return { didRegistry, auditLog, accessControl, recordRegistry };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Integration: End-to-end flow", () => {
  let admin: SignerWithAddress;
  let patient: SignerWithAddress;
  let doctor: SignerWithAddress;

  let didRegistry: DIDRegistry;
  let accessControl: HealthAccessControl;
  let auditLog: AuditLog;
  let recordRegistry: RecordRegistry;

  const PATIENT_DID = makeDID("did:health:vn:patient-001");
  const DOCTOR_DID = makeDID("did:health:vn:doctor-001");

  const SAMPLE_CID = "QmSampleIPFSHashABCDEF1234567890";
  const SAMPLE_HASH = ethers.keccak256(
    ethers.toUtf8Bytes("sample-file-content"),
  );

  beforeEach(async () => {
    [admin, patient, doctor] = await ethers.getSigners();
    ({ didRegistry, auditLog, accessControl, recordRegistry } = await deployAll(
      admin,
    ));
  });

  // ─── Flow chính ─────────────────────────────────────────────────────────────

  it("Patient grants access → Doctor adds & views record → Audit log recorded → Revoke → No access", async () => {
    // 1. Đăng ký DID cho patient và doctor
    await didRegistry
      .connect(patient)
      .registerDID(PATIENT_DID, "patientPubKey==", "https://patient.vn/health");

    await didRegistry
      .connect(doctor)
      .registerDID(DOCTOR_DID, "doctorPubKey==", "https://doctor.vn/health");

    // Verify DID đã đăng ký
    const patientIdentity = await didRegistry.resolveDID(PATIENT_DID);
    expect(patientIdentity.owner).to.equal(patient.address);
    expect(patientIdentity.isActive).to.be.true;

    // 2. Grant PROVIDER_ROLE cho doctor
    await accessControl.connect(admin).grantRole(PROVIDER_ROLE, doctor.address);

    // 3. Patient cấp quyền cho doctor trong 24h
    await accessControl
      .connect(patient)
      .grantAccess(PATIENT_DID, doctor.address, 24, ["lab", "imaging"]);

    expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
      .true;

    // 4. Doctor thêm hồ sơ
    await recordRegistry
      .connect(doctor)
      .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, "lab");

    // 5. Doctor xem hồ sơ thành công
    const records = await recordRegistry
      .connect(doctor)
      .getRecords(PATIENT_DID);
    expect(records.length).to.equal(1);
    expect(records[0].ipfsCID).to.equal(SAMPLE_CID);
    expect(records[0].dataHash).to.equal(SAMPLE_HASH);
    expect(records[0].createdBy).to.equal(doctor.address);

    // 6. Ghi VIEW log
    await recordRegistry.connect(doctor).viewRecords(PATIENT_DID);

    // 7. Query auditLog — phải có CREATE + VIEW
    const logs = await auditLog.queryLogs(PATIENT_DID);
    expect(logs.length).to.equal(2);
    expect(logs[0].action).to.equal("CREATE");
    expect(logs[0].actor).to.equal(doctor.address);
    expect(logs[1].action).to.equal("VIEW");
    expect(logs[1].actor).to.equal(doctor.address);

    // 8. Patient thu hồi quyền
    await accessControl
      .connect(patient)
      .revokeAccess(PATIENT_DID, doctor.address);
    expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
      .false;

    // 9. Doctor không còn xem được hồ sơ
    await expect(
      recordRegistry.connect(doctor).getRecords(PATIENT_DID),
    ).to.be.revertedWithCustomError(recordRegistry, "NoAccess");
  });

  // ─── Emergency access flow ───────────────────────────────────────────────────

  it("Emergency access: doctor truy cập khẩn → hasAccess true → 24h trôi qua → hasAccess false", async () => {
    // Grant PROVIDER_ROLE cho doctor
    await accessControl.connect(admin).grantRole(PROVIDER_ROLE, doctor.address);

    // Doctor dùng emergency access
    await accessControl
      .connect(doctor)
      .grantEmergencyAccess(PATIENT_DID, "Patient unconscious in ICU");

    // Ngay sau khi grant — có quyền
    expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
      .true;

    // Doctor có thể addRecord trong thời gian khẩn cấp
    await recordRegistry
      .connect(doctor)
      .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, "note");

    // Emergency log được ghi
    const emergencyLogs = await accessControl.getEmergencyLogs(PATIENT_DID);
    expect(emergencyLogs.length).to.equal(1);
    expect(emergencyLogs[0].reason).to.equal("Patient unconscious in ICU");

    // 24 giờ trôi qua
    await time.increase(24 * 60 * 60 + 1);

    // Hết hạn — không còn quyền
    expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
      .false;

    // Doctor không thể thêm hồ sơ nữa
    await expect(
      recordRegistry
        .connect(doctor)
        .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, "note"),
    ).to.be.revertedWithCustomError(recordRegistry, "NoAccess");
  });

  // ─── DID deactivate ──────────────────────────────────────────────────────────

  it("DID bị deactivate → không ảnh hưởng access control đang chạy nhưng DID không dùng được", async () => {
    await didRegistry
      .connect(patient)
      .registerDID(PATIENT_DID, "patientPubKey==", "https://patient.vn/health");

    await accessControl.connect(admin).grantRole(PROVIDER_ROLE, doctor.address);
    await accessControl
      .connect(patient)
      .grantAccess(PATIENT_DID, doctor.address, 24, ["lab"]);

    // Patient deactivate DID
    await didRegistry.connect(patient).deactivateDID(PATIENT_DID);
    expect(await didRegistry.isActive(PATIENT_DID)).to.be.false;

    // Patient không update DID được nữa
    await expect(
      didRegistry.connect(patient).updatePublicKey(PATIENT_DID, "newKey=="),
    ).to.be.revertedWithCustomError(didRegistry, "DIDInactive");

    // Access control vẫn hoạt động độc lập (2 contract riêng biệt)
    expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
      .true;
  });

  // ─── Paused contract ─────────────────────────────────────────────────────────

  it("RecordRegistry bị pause → addRecord revert → unpause → hoạt động lại", async () => {
    await accessControl.connect(admin).grantRole(PROVIDER_ROLE, doctor.address);
    await accessControl
      .connect(patient)
      .grantAccess(PATIENT_DID, doctor.address, 24, ["lab"]);

    // Pause contract
    await recordRegistry.connect(admin).pause();

    await expect(
      recordRegistry
        .connect(doctor)
        .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, "lab"),
    ).to.be.revertedWithCustomError(recordRegistry, "EnforcedPause");

    // Unpause
    await recordRegistry.connect(admin).unpause();

    await expect(
      recordRegistry
        .connect(doctor)
        .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, "lab"),
    ).to.not.be.reverted;
  });
});
