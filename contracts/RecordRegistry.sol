// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./HealthAccessControl.sol";
import "./AuditLog.sol";
import "./DIDRegistry.sol";

/**
 * @title RecordRegistry
 * @notice Lưu metadata hồ sơ y tế on-chain, file thực lưu trên IPFS
 */
contract RecordRegistry is Pausable, Ownable {
    HealthAccessControl public accessControl;
    AuditLog public auditLog;
    DIDRegistry public didRegistry;

    struct Record {
        bytes32 patientDID;
        string ipfsCID;
        bytes32 dataHash;
        string recordType;
        address createdBy;
        uint256 createdAt;
    }

    mapping(bytes32 => Record[]) private patientRecords;

    event RecordAdded(
        bytes32 indexed patientDID,
        address indexed createdBy,
        string recordType,
        string ipfsCID
    );

    error NoAccess(bytes32 patientDID, address caller);
    error EmptyCID();
    error EmptyRecordType();
    error InvalidDataHash();

    modifier onlyAuthorized(bytes32 patientDID) {
        bool isPatient = (didRegistry.getDIDByAddress(msg.sender) ==
            patientDID);
        bool hasPerms = accessControl.hasAccess(patientDID, msg.sender);
        if (!isPatient && !hasPerms) {
            revert NoAccess(patientDID, msg.sender);
        }
        _;
    }

    constructor(
        address _accessControl,
        address _auditLog,
        address _didRegistry
    ) Ownable(msg.sender) {
        accessControl = HealthAccessControl(_accessControl);
        auditLog = AuditLog(_auditLog);
        didRegistry = DIDRegistry(_didRegistry);
    }

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

        auditLog.log(msg.sender, patientDID, "CREATE");
        emit RecordAdded(patientDID, msg.sender, recordType, ipfsCID);
    }

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

    function getRecordCount(
        bytes32 patientDID
    ) external view onlyAuthorized(patientDID) returns (uint256) {
        return patientRecords[patientDID].length;
    }

    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }
}
