import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HealthAccessControl } from "../typechain-types/contracts/HealthAccessControl";
import { HealthAccessControl__factory } from "../typechain-types/factories/contracts/HealthAccessControl__factory";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("HealthAccessControl", () => {
  let accessControl: HealthAccessControl;
  let admin: SignerWithAddress;
  let patient: SignerWithAddress;
  let doctor: SignerWithAddress;
  let stranger: SignerWithAddress;

  const makeDID = (str: string) => ethers.keccak256(ethers.toUtf8Bytes(str));
  const PATIENT_DID = makeDID("did:health:vn:patient-001");
  const DATA_TYPES = ["lab", "imaging", "prescription"];

  const PROVIDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROVIDER_ROLE"));

  beforeEach(async () => {
    [admin, patient, doctor, stranger] = await ethers.getSigners();

    accessControl = await new HealthAccessControl__factory(admin).deploy();
    await accessControl.waitForDeployment();

    // Grant PROVIDER_ROLE cho doctor để test emergency access
    await accessControl.connect(admin).grantRole(PROVIDER_ROLE, doctor.address);
  });

  // ─── grantAccess ─────────────────────────────────────────

  describe("grantAccess", () => {
    it("should grant access and hasAccess returns true", async () => {
      await accessControl
        .connect(patient)
        .grantAccess(PATIENT_DID, doctor.address, 24, DATA_TYPES);

      expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
        .true;
    });

    it("should emit AccessGranted event", async () => {
      const tx = await accessControl
        .connect(patient)
        .grantAccess(PATIENT_DID, doctor.address, 24, DATA_TYPES);

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      const expectedExpiresAt = block!.timestamp + 24 * 3600;

      await expect(tx)
        .to.emit(accessControl, "AccessGranted")
        .withArgs(PATIENT_DID, doctor.address, expectedExpiresAt);
    });

    it("should revert if granting to self", async () => {
      await expect(
        accessControl
          .connect(patient)
          .grantAccess(PATIENT_DID, patient.address, 24, DATA_TYPES),
      ).to.be.revertedWithCustomError(accessControl, "CannotGrantToSelf");
    });

    it("should revert if durationHours is 0", async () => {
      await expect(
        accessControl
          .connect(patient)
          .grantAccess(PATIENT_DID, doctor.address, 0, DATA_TYPES),
      ).to.be.revertedWithCustomError(accessControl, "InvalidDuration");
    });

    it("access should expire after the given duration", async () => {
      await accessControl
        .connect(patient)
        .grantAccess(PATIENT_DID, doctor.address, 1, DATA_TYPES); // 1 giờ

      // Tăng thời gian lên 1 giờ 1 giây
      await time.increase(3601);

      expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
        .false;
    });
  });

  // ─── revokeAccess ────────────────────────────────────────

  describe("revokeAccess", () => {
    beforeEach(async () => {
      await accessControl
        .connect(patient)
        .grantAccess(PATIENT_DID, doctor.address, 24, DATA_TYPES);
    });

    it("should revoke and hasAccess returns false immediately", async () => {
      await accessControl
        .connect(patient)
        .revokeAccess(PATIENT_DID, doctor.address);
      expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
        .false;
    });

    it("should emit AccessRevoked event", async () => {
      await expect(
        accessControl
          .connect(patient)
          .revokeAccess(PATIENT_DID, doctor.address),
      )
        .to.emit(accessControl, "AccessRevoked")
        .withArgs(PATIENT_DID, doctor.address);
    });

    it("should revert if no active permission exists", async () => {
      await accessControl
        .connect(patient)
        .revokeAccess(PATIENT_DID, doctor.address);

      await expect(
        accessControl
          .connect(patient)
          .revokeAccess(PATIENT_DID, doctor.address),
      ).to.be.revertedWithCustomError(accessControl, "NoActivePermission");
    });
  });

  // ─── grantEmergencyAccess ─────────────────────────────────

  describe("grantEmergencyAccess", () => {
    const REASON = "Patient unconscious, critical care needed";

    it("should allow PROVIDER_ROLE to use emergency access", async () => {
      await accessControl
        .connect(doctor)
        .grantEmergencyAccess(PATIENT_DID, REASON);

      expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
        .true;
    });

    it("should emit EmergencyAccessUsed event", async () => {
      await expect(
        accessControl.connect(doctor).grantEmergencyAccess(PATIENT_DID, REASON),
      )
        .to.emit(accessControl, "EmergencyAccessUsed")
        .withArgs(PATIENT_DID, doctor.address, REASON);
    });

    it("should log emergency access entry", async () => {
      await accessControl
        .connect(doctor)
        .grantEmergencyAccess(PATIENT_DID, REASON);

      const logs = await accessControl.getEmergencyLogs(PATIENT_DID);
      expect(logs.length).to.equal(1);
      expect(logs[0].accessor).to.equal(doctor.address);
      expect(logs[0].reason).to.equal(REASON);
    });

    it("emergency access should expire after 24 hours", async () => {
      await accessControl
        .connect(doctor)
        .grantEmergencyAccess(PATIENT_DID, REASON);

      await time.increase(24 * 3600 + 1);

      expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
        .false;
    });

    it("should revert if caller does not have PROVIDER_ROLE", async () => {
      await expect(
        accessControl
          .connect(stranger)
          .grantEmergencyAccess(PATIENT_DID, REASON),
      ).to.be.revertedWithCustomError(
        accessControl,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  // ─── hasAccess ───────────────────────────────────────────

  describe("hasAccess", () => {
    it("should return false for an address with no permission", async () => {
      expect(await accessControl.hasAccess(PATIENT_DID, stranger.address)).to.be
        .false;
    });

    it("should return true while access is active and not expired", async () => {
      await accessControl
        .connect(patient)
        .grantAccess(PATIENT_DID, doctor.address, 48, DATA_TYPES);

      expect(await accessControl.hasAccess(PATIENT_DID, doctor.address)).to.be
        .true;
    });
  });
});
