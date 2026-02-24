// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HealthAccessControl
 * @notice Quản lý phân quyền truy cập hồ sơ y tế của bệnh nhân
 */
contract HealthAccessControl is AccessControl, ReentrancyGuard {
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint256 public constant EMERGENCY_DURATION = 24 hours;

    struct Permission {
        address grantee;
        uint256 expiresAt;
        string[] dataTypes; // ["lab", "imaging", "prescription"]
        bool isActive;
    }

    struct EmergencyAccess {
        address accessor;
        uint256 grantedAt;
        string reason;
    }

    // patientDID => grantee => Permission
    mapping(bytes32 => mapping(address => Permission)) public permissions;

    // patientDID => emergency access log
    mapping(bytes32 => EmergencyAccess[]) public emergencyLogs;

    // ─── Events ───────────────────────────────────────────
    event AccessGranted(
        bytes32 indexed patientDID,
        address indexed grantee,
        uint256 expiresAt
    );
    event AccessRevoked(bytes32 indexed patientDID, address indexed grantee);
    event EmergencyAccessUsed(
        bytes32 indexed patientDID,
        address indexed accessor,
        string reason
    );

    // ─── Errors ───────────────────────────────────────────
    error CannotGrantToSelf();
    error InvalidDuration();
    error NoActivePermission();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ─── Write functions ──────────────────────────────────

    /**
     * @notice Bệnh nhân cấp quyền cho bác sĩ truy cập hồ sơ
     * @param patientDID  DID của bệnh nhân (chỉ chính bệnh nhân mới được gọi)
     * @param doctor      Địa chỉ bác sĩ được cấp quyền
     * @param durationHours Thời hạn tính bằng giờ
     * @param dataTypes   Danh sách loại dữ liệu được phép truy cập
     */
    function grantAccess(
        bytes32 patientDID,
        address doctor,
        uint256 durationHours,
        string[] calldata dataTypes
    ) external nonReentrant {
        if (doctor == msg.sender) revert CannotGrantToSelf();
        if (durationHours == 0) revert InvalidDuration();

        uint256 expiresAt = block.timestamp + (durationHours * 1 hours);

        permissions[patientDID][doctor] = Permission({
            grantee: doctor,
            expiresAt: expiresAt,
            dataTypes: dataTypes,
            isActive: true
        });

        emit AccessGranted(patientDID, doctor, expiresAt);
    }

    /**
     * @notice Thu hồi quyền truy cập
     */
    function revokeAccess(
        bytes32 patientDID,
        address doctor
    ) external nonReentrant {
        Permission storage perm = permissions[patientDID][doctor];
        if (!perm.isActive) revert NoActivePermission();

        perm.isActive = false;

        emit AccessRevoked(patientDID, doctor);
    }

    /**
     * @notice Truy cập khẩn cấp — chỉ PROVIDER_ROLE, tự hết hạn sau 24h, ghi log
     * @param patientDID  DID bệnh nhân cần truy cập khẩn
     * @param reason      Lý do truy cập khẩn cấp
     */
    function grantEmergencyAccess(
        bytes32 patientDID,
        string calldata reason
    ) external onlyRole(PROVIDER_ROLE) nonReentrant {
        uint256 expiresAt = block.timestamp + EMERGENCY_DURATION;

        permissions[patientDID][msg.sender] = Permission({
            grantee: msg.sender,
            expiresAt: expiresAt,
            dataTypes: new string[](0),
            isActive: true
        });

        emergencyLogs[patientDID].push(
            EmergencyAccess({
                accessor: msg.sender,
                grantedAt: block.timestamp,
                reason: reason
            })
        );

        emit EmergencyAccessUsed(patientDID, msg.sender, reason);
        emit AccessGranted(patientDID, msg.sender, expiresAt);
    }

    // ─── Read functions ───────────────────────────────────

    /**
     * @notice Kiểm tra quyền truy cập còn hiệu lực không
     */
    function hasAccess(
        bytes32 patientDID,
        address requester
    ) external view returns (bool) {
        Permission storage perm = permissions[patientDID][requester];
        return perm.isActive && block.timestamp < perm.expiresAt;
    }

    /**
     * @notice Lấy danh sách emergency access log của bệnh nhân
     */
    function getEmergencyLogs(
        bytes32 patientDID
    ) external view returns (EmergencyAccess[] memory) {
        return emergencyLogs[patientDID];
    }
}
