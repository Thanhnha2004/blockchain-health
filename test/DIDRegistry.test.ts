import { expect } from "chai";
import { ethers } from "hardhat";
import { DIDRegistry } from "../typechain-types/contracts/DIDRegistry";
import { DIDRegistry__factory } from "../typechain-types/factories/contracts/DIDRegistry__factory";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("DIDRegistry", () => {
  let registry: DIDRegistry;
  let owner: SignerWithAddress;
  let patient: SignerWithAddress;
  let doctor: SignerWithAddress;

  const makeDID = (str: string) => ethers.keccak256(ethers.toUtf8Bytes(str));

  const PATIENT_DID = makeDID("did:health:vn:patient-001");
  const DOCTOR_DID = makeDID("did:health:vn:doctor-001");
  const SAMPLE_PUBKEY = "base64encodedRSApublickey==";
  const SAMPLE_ENDPOINT = "https://bachmai.vn/health-data";

  beforeEach(async () => {
    [owner, patient, doctor] = await ethers.getSigners();

    registry = await new DIDRegistry__factory(owner).deploy();
    await registry.waitForDeployment();
  });

  // ─── registerDID ─────────────────────────────────────────

  describe("registerDID", () => {
    it("should register a new DID successfully", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);

      const identity = await registry.resolveDID(PATIENT_DID);
      expect(identity.owner).to.equal(patient.address);
      expect(identity.publicKey).to.equal(SAMPLE_PUBKEY);
      expect(identity.serviceEndpoint).to.equal(SAMPLE_ENDPOINT);
      expect(identity.isActive).to.be.true;
    });

    it("should emit DIDRegistered event", async () => {
      await expect(
        registry
          .connect(patient)
          .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT),
      )
        .to.emit(registry, "DIDRegistered")
        .withArgs(PATIENT_DID, patient.address);
    });

    it("should revert if DID already exists", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);

      await expect(
        registry
          .connect(doctor)
          .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT),
      ).to.be.revertedWithCustomError(registry, "DIDAlreadyExists");
    });

    it("should revert if address already has a DID", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);

      const anotherDID = makeDID("did:health:vn:patient-002");
      await expect(
        registry
          .connect(patient)
          .registerDID(anotherDID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT),
      ).to.be.revertedWithCustomError(registry, "AddressAlreadyHasDID");
    });

    it("should revert if public key is empty", async () => {
      await expect(
        registry.connect(patient).registerDID(PATIENT_DID, "", SAMPLE_ENDPOINT),
      ).to.be.revertedWithCustomError(registry, "EmptyPublicKey");
    });

    it("should set updatedAt to current block timestamp", async () => {
      const tx = await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
      const block = await ethers.provider.getBlock(tx.blockNumber!);

      const identity = await registry.resolveDID(PATIENT_DID);
      expect(identity.updatedAt).to.equal(block!.timestamp);
    });
  });

  // ─── updatePublicKey ──────────────────────────────────────

  describe("updatePublicKey", () => {
    beforeEach(async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
    });

    it("should allow owner to update public key", async () => {
      const newKey = "newbase64encodedkey==";
      await registry.connect(patient).updatePublicKey(PATIENT_DID, newKey);

      const identity = await registry.resolveDID(PATIENT_DID);
      expect(identity.publicKey).to.equal(newKey);
    });

    it("should emit DIDUpdated event", async () => {
      await expect(
        registry.connect(patient).updatePublicKey(PATIENT_DID, "newkey=="),
      )
        .to.emit(registry, "DIDUpdated")
        .withArgs(PATIENT_DID, patient.address);
    });

    it("should revert if caller is not the DID owner", async () => {
      await expect(
        registry.connect(doctor).updatePublicKey(PATIENT_DID, "newkey=="),
      ).to.be.revertedWithCustomError(registry, "NotDIDOwner");
    });

    it("should revert if new public key is empty", async () => {
      await expect(
        registry.connect(patient).updatePublicKey(PATIENT_DID, ""),
      ).to.be.revertedWithCustomError(registry, "EmptyPublicKey");
    });
  });

  // ─── updateEndpoint ───────────────────────────────────────

  describe("updateEndpoint", () => {
    beforeEach(async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
    });

    it("should allow owner to update service endpoint", async () => {
      const newEndpoint = "https://newbackend.vn/health-data";
      await registry.connect(patient).updateEndpoint(PATIENT_DID, newEndpoint);

      const identity = await registry.resolveDID(PATIENT_DID);
      expect(identity.serviceEndpoint).to.equal(newEndpoint);
    });

    it("should revert if caller is not the DID owner", async () => {
      await expect(
        registry.connect(doctor).updateEndpoint(PATIENT_DID, "https://fake.vn"),
      ).to.be.revertedWithCustomError(registry, "NotDIDOwner");
    });
  });

  // ─── deactivateDID ────────────────────────────────────────

  describe("deactivateDID", () => {
    beforeEach(async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
    });

    it("should deactivate an active DID", async () => {
      await registry.connect(patient).deactivateDID(PATIENT_DID);
      expect(await registry.isActive(PATIENT_DID)).to.be.false;
    });

    it("should emit DIDDeactivated event", async () => {
      await expect(registry.connect(patient).deactivateDID(PATIENT_DID))
        .to.emit(registry, "DIDDeactivated")
        .withArgs(PATIENT_DID);
    });

    it("should revert if caller is not the DID owner", async () => {
      await expect(
        registry.connect(doctor).deactivateDID(PATIENT_DID),
      ).to.be.revertedWithCustomError(registry, "NotDIDOwner");
    });

    it("should revert when updating an inactive DID", async () => {
      await registry.connect(patient).deactivateDID(PATIENT_DID);

      await expect(
        registry.connect(patient).updatePublicKey(PATIENT_DID, "newkey=="),
      ).to.be.revertedWithCustomError(registry, "DIDInactive");
    });

    it("should revert when deactivating an already inactive DID", async () => {
      await registry.connect(patient).deactivateDID(PATIENT_DID);

      await expect(
        registry.connect(patient).deactivateDID(PATIENT_DID),
      ).to.be.revertedWithCustomError(registry, "DIDInactive");
    });
  });

  // ─── resolveDID ───────────────────────────────────────────

  describe("resolveDID", () => {
    it("should return full identity for a registered DID", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);

      const identity = await registry.resolveDID(PATIENT_DID);
      expect(identity.owner).to.equal(patient.address);
      expect(identity.publicKey).to.equal(SAMPLE_PUBKEY);
      expect(identity.serviceEndpoint).to.equal(SAMPLE_ENDPOINT);
      expect(identity.isActive).to.be.true;
    });

    it("should revert if DID does not exist", async () => {
      const unknownDID = makeDID("did:health:vn:nobody");
      await expect(
        registry.resolveDID(unknownDID),
      ).to.be.revertedWithCustomError(registry, "DIDNotFound");
    });
  });

  // ─── getDIDByAddress ──────────────────────────────────────

  describe("getDIDByAddress", () => {
    it("should return the DID of a registered address", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
      expect(await registry.getDIDByAddress(patient.address)).to.equal(
        PATIENT_DID,
      );
    });

    it("should return zero hash for an unregistered address", async () => {
      expect(await registry.getDIDByAddress(doctor.address)).to.equal(
        ethers.ZeroHash,
      );
    });
  });

  // ─── isActive ─────────────────────────────────────────────

  describe("isActive", () => {
    it("should return true for an active DID", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
      expect(await registry.isActive(PATIENT_DID)).to.be.true;
    });

    it("should return false for a deactivated DID", async () => {
      await registry
        .connect(patient)
        .registerDID(PATIENT_DID, SAMPLE_PUBKEY, SAMPLE_ENDPOINT);
      await registry.connect(patient).deactivateDID(PATIENT_DID);
      expect(await registry.isActive(PATIENT_DID)).to.be.false;
    });

    it("should return false for a non-existent DID", async () => {
      const unknownDID = makeDID("did:health:vn:nobody");
      expect(await registry.isActive(unknownDID)).to.be.false;
    });
  });
});
