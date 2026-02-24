import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { AuditLog } from "../typechain-types/contracts/AuditLog";
import { AuditLog__factory } from "../typechain-types/factories/contracts/AuditLog__factory";
import { RecordRegistry } from "../typechain-types/contracts/RecordRegistry";
import { RecordRegistry__factory } from "../typechain-types/factories/contracts/RecordRegistry__factory";
import { HealthAccessControl } from "../typechain-types/contracts/HealthAccessControl";
import { HealthAccessControl__factory } from "../typechain-types/factories/contracts/HealthAccessControl__factory";

describe("AuditLog", () => {
  let auditLog: AuditLog;
  let owner: SignerWithAddress;
  let authorizedContract: SignerWithAddress;
  let stranger: SignerWithAddress;

  const makeDID = (str: string) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const PATIENT_DID = makeDID("did:health:vn:patient-001");

  beforeEach(async () => {
    [owner, authorizedContract, stranger] = await ethers.getSigners();

    auditLog = await new AuditLog__factory(owner).deploy();
    await auditLog.waitForDeployment();
  });

  // ─── addAuthorizedContract ────────────────────────────────

  describe("addAuthorizedContract", () => {
    it("should whitelist a contract", async () => {
      await auditLog
        .connect(owner)
        .addAuthorizedContract(authorizedContract.address);
      expect(await auditLog.authorizedContracts(authorizedContract.address)).to
        .be.true;
    });

    it("should emit ContractAuthorized event", async () => {
      await expect(
        auditLog
          .connect(owner)
          .addAuthorizedContract(authorizedContract.address),
      )
        .to.emit(auditLog, "ContractAuthorized")
        .withArgs(authorizedContract.address);
    });

    it("should revert if already authorized", async () => {
      await auditLog
        .connect(owner)
        .addAuthorizedContract(authorizedContract.address);
      await expect(
        auditLog
          .connect(owner)
          .addAuthorizedContract(authorizedContract.address),
      ).to.be.revertedWithCustomError(auditLog, "AlreadyAuthorized");
    });

    it("should revert if caller is not owner", async () => {
      await expect(
        auditLog
          .connect(stranger)
          .addAuthorizedContract(authorizedContract.address),
      ).to.be.revertedWithCustomError(auditLog, "OwnableUnauthorizedAccount");
    });
  });

  // ─── removeAuthorizedContract ─────────────────────────────

  describe("removeAuthorizedContract", () => {
    beforeEach(async () => {
      await auditLog
        .connect(owner)
        .addAuthorizedContract(authorizedContract.address);
    });

    it("should deauthorize a contract", async () => {
      await auditLog
        .connect(owner)
        .removeAuthorizedContract(authorizedContract.address);
      expect(await auditLog.authorizedContracts(authorizedContract.address)).to
        .be.false;
    });

    it("should revert if contract was not authorized", async () => {
      await expect(
        auditLog.connect(owner).removeAuthorizedContract(stranger.address),
      ).to.be.revertedWithCustomError(auditLog, "NotAuthorized");
    });
  });

  // ─── log ──────────────────────────────────────────────────

  describe("log", () => {
    beforeEach(async () => {
      await auditLog
        .connect(owner)
        .addAuthorizedContract(authorizedContract.address);
    });

    it("should write a log entry from authorized contract", async () => {
      await auditLog
        .connect(authorizedContract)
        .log(authorizedContract.address, PATIENT_DID, "CREATE");

      expect(await auditLog.totalLogs()).to.equal(1);
    });

    it("should emit LogAdded event", async () => {
      await expect(
        auditLog
          .connect(authorizedContract)
          .log(authorizedContract.address, PATIENT_DID, "CREATE"),
      )
        .to.emit(auditLog, "LogAdded")
        .withArgs(PATIENT_DID, authorizedContract.address, "CREATE");
    });

    it("should revert if caller is not an authorized contract", async () => {
      await expect(
        auditLog.connect(stranger).log(stranger.address, PATIENT_DID, "CREATE"),
      ).to.be.revertedWithCustomError(auditLog, "NotAuthorizedContract");
    });

    it("should revert if action is empty", async () => {
      await expect(
        auditLog
          .connect(authorizedContract)
          .log(authorizedContract.address, PATIENT_DID, ""),
      ).to.be.revertedWithCustomError(auditLog, "EmptyAction");
    });
  });

  // ─── queryLogs ────────────────────────────────────────────

  describe("queryLogs", () => {
    beforeEach(async () => {
      await auditLog
        .connect(owner)
        .addAuthorizedContract(authorizedContract.address);
    });

    it("should return only logs for the given patientDID", async () => {
      const OTHER_DID = makeDID("did:health:vn:patient-002");

      await auditLog
        .connect(authorizedContract)
        .log(authorizedContract.address, PATIENT_DID, "CREATE");
      await auditLog
        .connect(authorizedContract)
        .log(authorizedContract.address, OTHER_DID, "VIEW");
      await auditLog
        .connect(authorizedContract)
        .log(authorizedContract.address, PATIENT_DID, "VIEW");

      const result = await auditLog.queryLogs(PATIENT_DID);
      expect(result.length).to.equal(2);
      expect(result[0].action).to.equal("CREATE");
      expect(result[1].action).to.equal("VIEW");
    });

    it("should return empty array for DID with no logs", async () => {
      const UNKNOWN_DID = makeDID("did:health:vn:nobody");
      const result = await auditLog.queryLogs(UNKNOWN_DID);
      expect(result.length).to.equal(0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("RecordRegistry", () => {
  let accessControl: HealthAccessControl;
  let auditLog: AuditLog;
  let registry: RecordRegistry;

  let owner: SignerWithAddress;
  let patient: SignerWithAddress;
  let doctor: SignerWithAddress;
  let stranger: SignerWithAddress;

  const makeDID = (str: string) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const PATIENT_DID = makeDID("did:health:vn:patient-001");
  const PROVIDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROVIDER_ROLE"));

  const SAMPLE_CID = "QmSampleIPFSHashABCDEF1234567890";
  const SAMPLE_HASH = ethers.keccak256(
    ethers.toUtf8Bytes("sample-file-content"),
  );
  const RECORD_TYPE = "lab";

  beforeEach(async () => {
    [owner, patient, doctor, stranger] = await ethers.getSigners();

    // Deploy theo đúng thứ tự
    auditLog = await new AuditLog__factory(owner).deploy();
    await auditLog.waitForDeployment();

    accessControl = await new HealthAccessControl__factory(owner).deploy();
    await accessControl.waitForDeployment();

    registry = await new RecordRegistry__factory(owner).deploy(
      await accessControl.getAddress(),
      await auditLog.getAddress(),
    );
    await registry.waitForDeployment();

    // Whitelist RecordRegistry trong AuditLog
    await auditLog
      .connect(owner)
      .addAuthorizedContract(await registry.getAddress());

    // Grant PROVIDER_ROLE cho doctor
    await accessControl.connect(owner).grantRole(PROVIDER_ROLE, doctor.address);

    // Patient cấp quyền cho doctor
    await accessControl
      .connect(patient)
      .grantAccess(PATIENT_DID, doctor.address, 24, ["lab", "imaging"]);
  });

  // ─── addRecord ───────────────────────────────────────────

  describe("addRecord", () => {
    it("should add a record successfully", async () => {
      await registry
        .connect(doctor)
        .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE);

      expect(
        await registry.connect(doctor).getRecordCount(PATIENT_DID),
      ).to.equal(1);
    });

    it("should emit RecordAdded event", async () => {
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE),
      )
        .to.emit(registry, "RecordAdded")
        .withArgs(PATIENT_DID, doctor.address, RECORD_TYPE, SAMPLE_CID);
    });

    it("should write a CREATE entry to AuditLog", async () => {
      await registry
        .connect(doctor)
        .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE);

      const logs = await auditLog.queryLogs(PATIENT_DID);
      expect(logs.length).to.equal(1);
      expect(logs[0].action).to.equal("CREATE");
      expect(logs[0].actor).to.equal(doctor.address);
    });

    it("should revert if caller has no access", async () => {
      await expect(
        registry
          .connect(stranger)
          .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE),
      ).to.be.revertedWithCustomError(registry, "NoAccess");
    });

    it("should revert if ipfsCID is empty", async () => {
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, "", SAMPLE_HASH, RECORD_TYPE),
      ).to.be.revertedWithCustomError(registry, "EmptyCID");
    });

    it("should revert if recordType is empty", async () => {
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, ""),
      ).to.be.revertedWithCustomError(registry, "EmptyRecordType");
    });

    it("should revert if dataHash is zero", async () => {
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, SAMPLE_CID, ethers.ZeroHash, RECORD_TYPE),
      ).to.be.revertedWithCustomError(registry, "InvalidDataHash");
    });

    it("should revert when contract is paused", async () => {
      await registry.connect(owner).pause();
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
  });

  // ─── getRecords ───────────────────────────────────────────

  describe("getRecords", () => {
    beforeEach(async () => {
      await registry
        .connect(doctor)
        .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE);
    });

    it("should return records for authorized caller", async () => {
      // getRecords là view → gọi bình thường
      const records = await registry.connect(doctor).getRecords(PATIENT_DID);
      expect(records.length).to.equal(1);
      expect(records[0].ipfsCID).to.equal(SAMPLE_CID);
      expect(records[0].dataHash).to.equal(SAMPLE_HASH);
      expect(records[0].recordType).to.equal(RECORD_TYPE);
      expect(records[0].createdBy).to.equal(doctor.address);
    });

    it("should write a VIEW entry to AuditLog when getRecords is called", async () => {
      // viewRecords là transaction → ghi log
      await registry.connect(doctor).viewRecords(PATIENT_DID);

      const logs = await auditLog.queryLogs(PATIENT_DID);
      expect(logs.length).to.equal(2);
      expect(logs[1].action).to.equal("VIEW");
    });

    it("should revert if caller has no access", async () => {
      await expect(
        registry.connect(stranger).getRecords(PATIENT_DID),
      ).to.be.revertedWithCustomError(registry, "NoAccess");
    });
  });

  // ─── pause / unpause ──────────────────────────────────────

  describe("pause / unpause", () => {
    it("should allow owner to pause and unpause", async () => {
      await registry.connect(owner).pause();
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE),
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.connect(owner).unpause();
      await expect(
        registry
          .connect(doctor)
          .addRecord(PATIENT_DID, SAMPLE_CID, SAMPLE_HASH, RECORD_TYPE),
      ).to.not.be.reverted;
    });

    it("should revert if non-owner tries to pause", async () => {
      await expect(
        registry.connect(stranger).pause(),
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });
});
