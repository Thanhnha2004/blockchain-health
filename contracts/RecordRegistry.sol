// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./HealthAccessControl.sol";
import "./AuditLog.sol";

/**
 * @title RecordRegistry
 * @notice Lưu metadata hồ sơ y tế on-chain, file thực lưu trên IPFS
 * @dev Cross-contract call đến HealthAccessControl để check quyền truy cập
 */
contract RecordRegistry is Pausable, Ownable {
    HealthAccessControl public accessControl;
    AuditLog public auditLog;

    struct Record {
        bytes32 patientDID;
        string ipfsCID; // CID trỏ đến file mã hóa trên IPFS
        bytes32 dataHash; // SHA-256 của file gốc để verify toàn vẹn
        string recordType; // "lab" | "imaging" | "prescription" | "note"
        address createdBy;
        uint256 createdAt;
    }

    // patientDID => mảng record
    mapping(bytes32 => Record[]) private patientRecords;

    // ─── Events ───────────────────────────────────────────
    event RecordAdded(
        bytes32 indexed patientDID,
        address indexed createdBy,
        string recordType,
        string ipfsCID
    );

    // ─── Errors ───────────────────────────────────────────
    error NoAccess(bytes32 patientDID, address caller);
    error EmptyCID();
    error EmptyRecordType();
    error InvalidDataHash();

    // ─── Modifiers ────────────────────────────────────────
    modifier onlyAuthorized(bytes32 patientDID) {
        if (!accessControl.hasAccess(patientDID, msg.sender)) {
            revert NoAccess(patientDID, msg.sender);
        }
        _;
    }

    constructor(address _accessControl, address _auditLog) Ownable(msg.sender) {
        accessControl = HealthAccessControl(_accessControl);
        auditLog = AuditLog(_auditLog);
    }

    // ─── Write functions ──────────────────────────────────

    /**
     * @notice Thêm hồ sơ y tế mới — chỉ người có quyền truy cập mới gọi được
     * @param patientDID  DID của bệnh nhân
     * @param ipfsCID     CID của file mã hóa đã upload lên IPFS
     * @param dataHash    SHA-256 hash của file gốc (trước khi mã hóa)
     * @param recordType  Loại hồ sơ: "lab" | "imaging" | "prescription" | "note"
     */
    function addRecord(
        bytes32 patientDID,
        string calldata ipfsCID,
        bytes32 dataHash,
        string calldata recordType
    ) external whenNotPaused onlyAuthorized(patientDID) {
        if (bytes(ipfsCID).length == 0) revert EmptyCID();
        if (bytes(recordType).length == 0) revert EmptyRecordType();
        if (dataHash == bytes32(0)) revert InvalidDataHash();

        patientRecords[patientDID].push(
            Record({
                patientDID: patientDID,
                ipfsCID: ipfsCID,
                dataHash: dataHash,
                recordType: recordType,
                createdBy: msg.sender,
                createdAt: block.timestamp
            })
        );

        // Ghi audit log — cross-contract call
        auditLog.log(msg.sender, patientDID, "CREATE");

        emit RecordAdded(patientDID, msg.sender, recordType, ipfsCID);
    }

    /**
     * @notice Lấy tất cả hồ sơ của bệnh nhân — chỉ người có quyền mới xem được
     */
    function getRecords(
        bytes32 patientDID
    ) external view onlyAuthorized(patientDID) returns (Record[] memory) {
        return patientRecords[patientDID];
    }

    function viewRecords(
        bytes32 patientDID
    ) external onlyAuthorized(patientDID) returns (Record[] memory) {
        auditLog.log(msg.sender, patientDID, "VIEW");
        return patientRecords[patientDID];
    }

    /**
     * @notice Đếm số hồ sơ của bệnh nhân — chỉ người có quyền
     */
    function getRecordCount(
        bytes32 patientDID
    ) external view onlyAuthorized(patientDID) returns (uint256) {
        return patientRecords[patientDID].length;
    }

    // ─── Admin functions ──────────────────────────────────

    /**
     * @notice Tạm dừng contract trong tình huống khẩn cấp
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
