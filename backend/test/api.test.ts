import { expect } from "chai";
import request from "supertest";
import sinon from "sinon";
import app from "../src/app";
import * as ipfsService from "../src/services/ipfs.service";
import * as contractService from "../src/services/contract.service";

const MOCK_CID = "QmMockCIDabc123";
const MOCK_PATIENT = "0x" + "a".repeat(64);
const MOCK_DOCTOR = "0x" + "1".repeat(40);
const MOCK_TX_HASH = "0x" + "f".repeat(64);

const MOCK_RECORD = {
  ipfsCID: MOCK_CID,
  dataHash: "0x" + "b".repeat(64),
  recordType: "lab",
  createdBy: MOCK_DOCTOR,
  createdAt: BigInt(1700000000),
};

describe("API Integration Tests", () => {
  const mockTx = { hash: MOCK_TX_HASH, wait: async () => ({}) };

  const mockRecord = {
    addRecord: sinon.stub().resolves(mockTx),
    getRecords: sinon.stub().resolves([MOCK_RECORD]),
  };
  const mockAccess = {
    hasAccess: sinon.stub().resolves(true),
    grantAccess: sinon.stub().resolves(mockTx),
    revokeAccess: sinon.stub().resolves(mockTx),
  };
  const mockAudit = {
    queryLogs: sinon.stub().resolves([]),
  };

  let uploadStub: sinon.SinonStub;
  let fetchStub: sinon.SinonStub;

  beforeEach(() => {
    uploadStub = sinon.stub(ipfsService, "uploadToIPFS").resolves(MOCK_CID);
    fetchStub = sinon
      .stub(ipfsService, "fetchFromIPFS")
      .resolves(Buffer.from("encrypted"));

    sinon.stub(contractService, "getRecordRegistry").returns(mockRecord as any);
    sinon.stub(contractService, "getAccessControl").returns(mockAccess as any);
    sinon.stub(contractService, "getAuditLog").returns(mockAudit as any);

    // Reset behavior về default sau mỗi test
    mockRecord.addRecord.resolves(mockTx);
    mockRecord.getRecords.resolves([MOCK_RECORD]);
    mockAccess.hasAccess.resolves(true);
    mockAccess.grantAccess.resolves(mockTx);
    mockAccess.revokeAccess.resolves(mockTx);
    mockAudit.queryLogs.resolves([]); // ← reset về empty array
  });

  afterEach(() => {
    sinon.restore();
    mockRecord.addRecord.resetHistory();
    mockRecord.getRecords.resetHistory();
    mockAccess.hasAccess.resetHistory();
    mockAccess.grantAccess.resetHistory();
    mockAccess.revokeAccess.resetHistory();
    mockAudit.queryLogs.resetHistory();
  });

  // POST /records
  describe("POST /records", () => {
    it("should upload file and return CID and txHash", async () => {
      const res = await request(app)
        .post("/records")
        .field("patientDID", MOCK_PATIENT)
        .field("recordType", "lab")
        .attach("file", Buffer.from("test file content"), "test.txt");

      expect(res.status).to.equal(201);
      expect(res.body.ipfsCID).to.equal(MOCK_CID);
      expect(res.body.txHash).to.equal(MOCK_TX_HASH);
      expect(uploadStub.calledOnce).to.be.true;
      expect(mockRecord.addRecord.calledOnce).to.be.true;
    });

    it("should return 400 if file is missing", async () => {
      const res = await request(app)
        .post("/records")
        .send({ patientDID: MOCK_PATIENT, recordType: "lab" });

      expect(res.status).to.equal(400);
      expect(res.body.error).to.include("file");
    });

    it("should return 400 if patientDID is missing", async () => {
      const res = await request(app)
        .post("/records")
        .field("recordType", "lab")
        .attach("file", Buffer.from("content"), "test.txt");

      expect(res.status).to.equal(400);
    });

    it("should return 500 if IPFS upload fails", async () => {
      uploadStub.rejects(new Error("IPFS gateway timeout"));

      const res = await request(app)
        .post("/records")
        .field("patientDID", MOCK_PATIENT)
        .field("recordType", "lab")
        .attach("file", Buffer.from("content"), "test.txt");

      expect(res.status).to.equal(500);
    });
  });

  // GET /records/:patientDID
  describe("GET /records/:patientDID", () => {
    it("should return records metadata for authorized caller", async () => {
      const res = await request(app)
        .get(`/records/${MOCK_PATIENT}`)
        .query({ callerAddress: MOCK_DOCTOR });

      expect(res.status).to.equal(200);
      expect(res.body.records).to.have.length(1);
      expect(res.body.records[0].ipfsCID).to.equal(MOCK_CID);
    });

    it("should return 403 if caller has no access", async () => {
      mockAccess.hasAccess.resolves(false);

      const res = await request(app)
        .get(`/records/${MOCK_PATIENT}`)
        .query({ callerAddress: MOCK_DOCTOR });

      expect(res.status).to.equal(403);
      expect(res.body.error).to.equal("Access denied");
    });

    it("should return 400 if callerAddress is missing", async () => {
      const res = await request(app).get(`/records/${MOCK_PATIENT}`);
      expect(res.status).to.equal(400);
    });
  });

  // POST /access/grant
  describe("POST /access/grant", () => {
    it("should grant access and return txHash", async () => {
      const res = await request(app)
        .post("/access/grant")
        .send({
          patientDID: MOCK_PATIENT,
          doctorAddress: MOCK_DOCTOR,
          durationHours: 24,
          dataTypes: ["lab", "imaging"],
        });

      expect(res.status).to.equal(201);
      expect(res.body.txHash).to.equal(MOCK_TX_HASH);
      expect(mockAccess.grantAccess.calledOnce).to.be.true;
    });

    it("should return 400 if dataTypes is empty array", async () => {
      const res = await request(app).post("/access/grant").send({
        patientDID: MOCK_PATIENT,
        doctorAddress: MOCK_DOCTOR,
        durationHours: 24,
        dataTypes: [],
      });

      expect(res.status).to.equal(400);
    });

    it("should return 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/access/grant")
        .send({ patientDID: MOCK_PATIENT });

      expect(res.status).to.equal(400);
    });
  });

  // POST /access/revoke
  describe("POST /access/revoke", () => {
    it("should revoke access and return txHash", async () => {
      const res = await request(app)
        .post("/access/revoke")
        .send({ patientDID: MOCK_PATIENT, doctorAddress: MOCK_DOCTOR });

      expect(res.status).to.equal(200);
      expect(res.body.txHash).to.equal(MOCK_TX_HASH);
      expect(mockAccess.revokeAccess.calledOnce).to.be.true;
    });
  });

  // GET /access/audit/:patientDID
  describe("GET /access/audit/:patientDID", () => {
    it("should return audit logs for patient", async () => {
      mockAudit.queryLogs.resolves([
        {
          actor: MOCK_DOCTOR,
          action: "CREATE",
          timestamp: BigInt(1700000000),
          patientDID: MOCK_PATIENT,
        },
      ]);

      const res = await request(app).get(`/access/audit/${MOCK_PATIENT}`);

      expect(res.status).to.equal(200);
      expect(res.body.logs).to.have.length(1);
      expect(res.body.logs[0].action).to.equal("CREATE");
    });

    it("should return empty array if no logs", async () => {
      const res = await request(app).get(`/access/audit/${MOCK_PATIENT}`);
      expect(res.status).to.equal(200);
      expect(res.body.logs).to.have.length(0);
    });
  });
});
