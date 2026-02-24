// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AuditLog
 * @notice Ghi lại mọi hành động truy cập hồ sơ y tế on-chain
 * @dev Chỉ các contract được whitelist mới được ghi log — không phải user trực tiếp
 */
contract AuditLog is Ownable {
    struct LogEntry {
        address actor;
        bytes32 patientDID;
        string action; // "VIEW" | "CREATE" | "GRANT" | "REVOKE" | "EMERGENCY"
        uint256 timestamp;
        bytes32 txContext; // tx.origin hash để trace nếu cần
    }

    LogEntry[] public logs;

    // Chỉ contract đã whitelist mới ghi được
    mapping(address => bool) public authorizedContracts;

    // ─── Events ───────────────────────────────────────────
    event LogAdded(
        bytes32 indexed patientDID,
        address indexed actor,
        string action
    );
    event ContractAuthorized(address indexed contractAddr);
    event ContractDeauthorized(address indexed contractAddr);

    // ─── Errors ───────────────────────────────────────────
    error NotAuthorizedContract(address caller);
    error AlreadyAuthorized(address contractAddr);
    error NotAuthorized(address contractAddr);
    error EmptyAction();

    modifier onlyAuthorizedContract() {
        if (!authorizedContracts[msg.sender]) {
            revert NotAuthorizedContract(msg.sender);
        }
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ─── Admin functions ──────────────────────────────────

    /**
     * @notice Whitelist một contract để có quyền ghi log
     */
    function addAuthorizedContract(address contractAddr) external onlyOwner {
        if (authorizedContracts[contractAddr])
            revert AlreadyAuthorized(contractAddr);
        authorizedContracts[contractAddr] = true;
        emit ContractAuthorized(contractAddr);
    }

    /**
     * @notice Xoá whitelist của một contract
     */
    function removeAuthorizedContract(address contractAddr) external onlyOwner {
        if (!authorizedContracts[contractAddr])
            revert NotAuthorized(contractAddr);
        authorizedContracts[contractAddr] = false;
        emit ContractDeauthorized(contractAddr);
    }

    // ─── Write functions ──────────────────────────────────

    /**
     * @notice Ghi một log entry — chỉ authorized contract mới gọi được
     * @param actor      Địa chỉ người thực hiện hành động
     * @param patientDID DID của bệnh nhân liên quan
     * @param action     Hành động: "VIEW" | "CREATE" | "GRANT" | "REVOKE" | "EMERGENCY"
     */
    function log(
        address actor,
        bytes32 patientDID,
        string calldata action
    ) external onlyAuthorizedContract {
        if (bytes(action).length == 0) revert EmptyAction();

        logs.push(
            LogEntry({
                actor: actor,
                patientDID: patientDID,
                action: action,
                timestamp: block.timestamp,
                txContext: keccak256(abi.encodePacked(tx.origin, block.number))
            })
        );

        emit LogAdded(patientDID, actor, action);
    }

    // ─── Read functions ───────────────────────────────────

    /**
     * @notice Lấy tất cả log của một bệnh nhân
     */
    function queryLogs(
        bytes32 patientDID
    ) external view returns (LogEntry[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].patientDID == patientDID) count++;
        }

        LogEntry[] memory result = new LogEntry[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].patientDID == patientDID) {
                result[idx++] = logs[i];
            }
        }
        return result;
    }

    /**
     * @notice Tổng số log entries
     */
    function totalLogs() external view returns (uint256) {
        return logs.length;
    }
}
