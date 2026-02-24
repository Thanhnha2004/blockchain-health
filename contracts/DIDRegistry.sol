// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DIDRegistry
 * @notice Quản lý định danh phi tập trung (DID) cho bệnh nhân và bác sĩ
 */
contract DIDRegistry is Ownable {
    struct Identity {
        address owner;
        string publicKey; // RSA public key dạng base64 — dùng để mã hóa AES key
        string serviceEndpoint; // URL backend để lấy dữ liệu off-chain
        bool isActive;
        uint256 updatedAt;
    }

    // did hash => Identity
    mapping(bytes32 => Identity) public identities;

    // address => did hash — để tìm DID của một địa chỉ
    mapping(address => bytes32) private addressToDID;

    // ─── Events ───────────────────────────────────────────
    event DIDRegistered(bytes32 indexed did, address indexed owner);
    event DIDUpdated(bytes32 indexed did, address indexed owner);
    event DIDDeactivated(bytes32 indexed did);

    // ─── Errors ───────────────────────────────────────────
    error DIDAlreadyExists(bytes32 did);
    error DIDNotFound(bytes32 did);
    error DIDInactive(bytes32 did);
    error NotDIDOwner(bytes32 did, address caller);
    error AddressAlreadyHasDID(address owner);
    error EmptyPublicKey();

    // ─── Modifiers ────────────────────────────────────────
    modifier onlyDIDOwner(bytes32 did) {
        if (identities[did].owner != msg.sender) {
            revert NotDIDOwner(did, msg.sender);
        }
        _;
    }

    modifier didMustExist(bytes32 did) {
        if (identities[did].owner == address(0)) {
            revert DIDNotFound(did);
        }
        _;
    }

    modifier didMustBeActive(bytes32 did) {
        if (!identities[did].isActive) {
            revert DIDInactive(did);
        }
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ─── Write functions ──────────────────────────────────

    /**
     * @notice Đăng ký DID mới
     * @param did       bytes32 hash của DID string, ví dụ keccak256("did:health:vn:0x1234...")
     * @param pubKey    RSA public key dạng base64
     * @param endpoint  URL backend của người dùng
     */
    function registerDID(
        bytes32 did,
        string calldata pubKey,
        string calldata endpoint
    ) external {
        if (identities[did].owner != address(0)) revert DIDAlreadyExists(did);
        if (addressToDID[msg.sender] != bytes32(0))
            revert AddressAlreadyHasDID(msg.sender);
        if (bytes(pubKey).length == 0) revert EmptyPublicKey();

        identities[did] = Identity({
            owner: msg.sender,
            publicKey: pubKey,
            serviceEndpoint: endpoint,
            isActive: true,
            updatedAt: block.timestamp
        });

        addressToDID[msg.sender] = did;

        emit DIDRegistered(did, msg.sender);
    }

    /**
     * @notice Cập nhật public key — ví dụ khi rotate key định kỳ
     */
    function updatePublicKey(
        bytes32 did,
        string calldata newPubKey
    ) external onlyDIDOwner(did) didMustExist(did) didMustBeActive(did) {
        if (bytes(newPubKey).length == 0) revert EmptyPublicKey();

        identities[did].publicKey = newPubKey;
        identities[did].updatedAt = block.timestamp;

        emit DIDUpdated(did, msg.sender);
    }

    /**
     * @notice Cập nhật service endpoint
     */
    function updateEndpoint(
        bytes32 did,
        string calldata newEndpoint
    ) external onlyDIDOwner(did) didMustExist(did) didMustBeActive(did) {
        identities[did].serviceEndpoint = newEndpoint;
        identities[did].updatedAt = block.timestamp;

        emit DIDUpdated(did, msg.sender);
    }

    /**
     * @notice Vô hiệu hóa DID — không thể reactivate, không thể đăng ký lại
     */
    function deactivateDID(
        bytes32 did
    ) external onlyDIDOwner(did) didMustExist(did) didMustBeActive(did) {
        identities[did].isActive = false;
        identities[did].updatedAt = block.timestamp;

        emit DIDDeactivated(did);
    }

    // ─── Read functions ───────────────────────────────────

    function resolveDID(
        bytes32 did
    ) external view didMustExist(did) returns (Identity memory) {
        return identities[did];
    }

    function getDIDByAddress(address owner) external view returns (bytes32) {
        return addressToDID[owner];
    }

    function isActive(bytes32 did) external view returns (bool) {
        return identities[did].isActive;
    }
}
