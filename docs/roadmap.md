# Blockchain Health System — Learning & Build Roadmap

> Từ Solidity cơ bản đến hệ thống y tế production-ready  
> **Stack:** Solidity + Hardhat + OpenZeppelin + Ethers.js v6 | **Thời gian:** 16 tuần

---

## Stack chính thức của project

```json
{
  "devDependencies": {
    "hardhat": "^2.25.0",
    "@nomicfoundation/hardhat-ethers": "^3.0.8",
    "@nomicfoundation/hardhat-chai-matchers": "^2.1.0",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.10",
    "@nomicfoundation/hardhat-verify": "^2.0.12",
    "@openzeppelin/hardhat-upgrades": "^3.9.0",
    "@typechain/hardhat": "^9.0.0",
    "hardhat-gas-reporter": "2.3.0",
    "hardhat-contract-sizer": "^2.9.0",
    "hardhat-deploy": "^1.0.1",
    "typescript": "^5.0.4"
  },
  "dependencies": {
    "@openzeppelin/contracts": "^5.1.0",
    "@openzeppelin/contracts-upgradeable": "5.3.0",
    "@chainlink/contracts": "^1.5.0",
    "ethers": "^6.13.5"
  }
}
```

---

## Tổng quan 4 giai đoạn

| Phase | Tên                    | Nội dung                              | Tuần    |
| ----- | ---------------------- | ------------------------------------- | ------- |
| 1     | Smart Contract Layer   | 4 contract cốt lõi + testing          | 1 – 4   |
| 2     | Off-chain & Storage    | IPFS, mã hóa, backend Node.js         | 5 – 8   |
| 3     | Frontend & Integration | Ethers.js v6, React, wallet           | 9 – 12  |
| 4     | Deploy & Hardening     | Sepolia testnet, security, monitoring | 13 – 16 |

---

## Phase 1 — Smart Contract Layer (Tuần 1–4)

**Mục tiêu:** Viết và test 4 smart contract cốt lõi chạy được trên local Hardhat network.

### Tuần 1 — Setup môi trường & DIDRegistry.sol

#### Setup môi trường

```bash
# Cài dependencies
npm install

# Compile để kiểm tra setup đúng
npm run compile

# Chạy local node
npm run node
```

Cấu trúc thư mục cần tạo:

```
contracts/
  DIDRegistry.sol
  AccessControl.sol
  RecordRegistry.sol
  AuditLog.sol
deploy/
  01_deploy_did_registry.ts
  02_deploy_access_control.ts
  03_deploy_audit_log.ts
  04_deploy_record_registry.ts
test/
  DIDRegistry.test.ts
  AccessControl.test.ts
  integration.test.ts
```

#### Contract: DIDRegistry.sol

Quản lý định danh phi tập trung cho bệnh nhân và bác sĩ. Dùng `Ownable` từ OpenZeppelin.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DIDRegistry is Ownable {
    struct Identity {
        address owner;
        string publicKey;        // để mã hóa dữ liệu off-chain
        string serviceEndpoint;  // URL backend lấy dữ liệu
        bool isActive;
        uint256 updatedAt;
    }

    mapping(bytes32 => Identity) public identities;

    event DIDRegistered(bytes32 indexed did, address indexed owner);
    event DIDUpdated(bytes32 indexed did);
    event DIDDeactivated(bytes32 indexed did);

    modifier onlyDIDOwner(bytes32 did) {
        require(identities[did].owner == msg.sender, "Not DID owner");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function registerDID(bytes32 did, string calldata pubKey, string calldata endpoint) external;
    function updateDID(bytes32 did, string calldata pubKey) external onlyDIDOwner(did);
    function deactivateDID(bytes32 did) external onlyDIDOwner(did);
    function resolveDID(bytes32 did) external view returns (Identity memory);
}
```

**Test cases cần viết:**

- [✅] Đăng ký DID thành công
- [✅] Không thể đăng ký DID đã tồn tại
- [✅] Chỉ owner mới update được
- [✅] `resolveDID` trả về đúng data
- [✅] Deactivate rồi không đăng ký lại được

---

### Tuần 2 — AccessControl.sol (Contract quan trọng nhất)

Toàn bộ logic phân quyền nằm ở đây. Dùng `AccessControl` của OpenZeppelin làm base cho role management.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract HealthAccessControl is AccessControl, ReentrancyGuard {
    bytes32 public constant PROVIDER_ROLE = keccak256("PROVIDER_ROLE");
    bytes32 public constant ADMIN_ROLE    = keccak256("ADMIN_ROLE");

    struct Permission {
        address grantee;
        uint256 expiresAt;
        string[] dataTypes;   // ["lab", "imaging", "prescription"]
        bool isActive;
    }

    struct EmergencyAccess {
        address accessor;
        uint256 grantedAt;
        string reason;
    }

    // patientDID → grantee → Permission
    mapping(bytes32 => mapping(address => Permission)) public permissions;

    // patientDID → emergency access log
    mapping(bytes32 => EmergencyAccess[]) public emergencyLogs;

    event AccessGranted(bytes32 indexed patientDID, address indexed grantee, uint256 expiresAt);
    event AccessRevoked(bytes32 indexed patientDID, address indexed grantee);
    event EmergencyAccessUsed(bytes32 indexed patientDID, address indexed accessor, string reason);

    function grantAccess(
        bytes32 patientDID,
        address doctor,
        uint256 durationHours,
        string[] calldata dataTypes
    ) external;

    function revokeAccess(bytes32 patientDID, address doctor) external;

    // Tự động hết hạn sau 24h, ghi vào emergency log
    function grantEmergencyAccess(bytes32 patientDID, string calldata reason)
        external
        onlyRole(PROVIDER_ROLE);

    function hasAccess(bytes32 patientDID, address requester) external view returns (bool);
}
```

**Những điểm cần chú ý khi implement:**

- Dùng `block.timestamp` để check quyền chưa hết hạn
- Emergency access ghi log nhưng không cần bệnh nhân approve — bệnh nhân được notify sau
- Không cho phép grant quyền cho chính `msg.sender`
- Mọi thao tác đều emit event — đây là audit trail on-chain

**Test cases cần viết:**

- [✅] Grant và check access thành công
- [✅] Access hết hạn đúng thời điểm
- [✅] Revoke → `hasAccess` trả về false ngay lập tức
- [✅] Emergency access tự hết hạn sau 24h
- [✅] Không tự grant cho mình được
- [✅] Chỉ `PROVIDER_ROLE` mới dùng emergency access

---

### Tuần 3 — RecordRegistry.sol & AuditLog.sol

#### RecordRegistry.sol

Import và gọi `HealthAccessControl` để check quyền. Đây là lần đầu bạn làm cross-contract call.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Pausable.sol";
import "./HealthAccessControl.sol";
import "./AuditLog.sol";

contract RecordRegistry is Pausable {
    HealthAccessControl public accessControl;
    AuditLog public auditLog;

    struct Record {
        bytes32 patientDID;
        string ipfsCID;       // trỏ đến file thực trên IPFS
        bytes32 dataHash;     // SHA-256 để verify tính toàn vẹn
        string recordType;    // "lab" | "imaging" | "prescription" | "note"
        address createdBy;
        uint256 createdAt;
    }

    // patientDID → mảng record
    mapping(bytes32 => Record[]) private patientRecords;

    modifier onlyAuthorized(bytes32 patientDID) {
        require(
            accessControl.hasAccess(patientDID, msg.sender),
            "No access to this patient"
        );
        _;
    }

    constructor(address _accessControl, address _auditLog) {
        accessControl = HealthAccessControl(_accessControl);
        auditLog = AuditLog(_auditLog);
    }

    function addRecord(
        bytes32 patientDID,
        string calldata ipfsCID,
        bytes32 dataHash,
        string calldata recordType
    ) external whenNotPaused;

    function getRecords(bytes32 patientDID)
        external
        view
        onlyAuthorized(patientDID)
        returns (Record[] memory);
}
```

#### AuditLog.sol

Chỉ các contract đã đăng ký mới được ghi log — không phải user trực tiếp.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AuditLog is Ownable {
    struct LogEntry {
        address actor;
        bytes32 patientDID;
        string action;       // "VIEW" | "CREATE" | "GRANT" | "REVOKE" | "EMERGENCY"
        uint256 timestamp;
        bytes32 txContext;
    }

    LogEntry[] public logs;

    // Chỉ contract đã whitelist mới ghi được
    mapping(address => bool) public authorizedContracts;

    modifier onlyAuthorizedContract() {
        require(authorizedContracts[msg.sender], "Not authorized contract");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function addAuthorizedContract(address contractAddr) external onlyOwner;

    function log(
        address actor,
        bytes32 patientDID,
        string calldata action
    ) external onlyAuthorizedContract;

    function queryLogs(bytes32 patientDID)
        external
        view
        returns (LogEntry[] memory);
}
```

---

### Tuần 4 — Integration, Gas Optimization & Hardhat Scripts

**Integration test** — file `test/integration.test.ts`:

```typescript
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("End-to-end flow", () => {
  it("Patient grants access → Doctor views record → Audit log recorded", async () => {
    const [admin, patient, doctor] = await ethers.getSigners();

    // 1. Deploy tất cả contract theo đúng thứ tự
    // 2. Đăng ký DID cho patient và doctor
    // 3. Grant PROVIDER_ROLE cho doctor
    // 4. Patient grantAccess cho doctor
    // 5. Doctor addRecord
    // 6. Doctor getRecords thành công
    // 7. Query auditLog → có entry "CREATE"
    // 8. Patient revoke access
    // 9. Doctor getRecords → revert "No access"
  });

  it("Emergency access flow", async () => {
    // Grant emergency → check hasAccess → 24h trôi qua → check hasAccess = false
    await time.increase(24 * 60 * 60 + 1);
  });
});
```

**Deploy script** với `hardhat-deploy`:

```typescript
// deploy/00_deploy_all.ts
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();

  // Thứ tự deploy quan trọng: AuditLog → AccessControl → RecordRegistry
  const auditLog = await deploy("AuditLog", { from: deployer, log: true });
  const accessControl = await deploy("HealthAccessControl", {
    from: deployer,
    log: true,
  });
  const recordRegistry = await deploy("RecordRegistry", {
    from: deployer,
    args: [accessControl.address, auditLog.address],
    log: true,
  });

  // Whitelist RecordRegistry trong AuditLog
  // Thêm bước setup sau deploy ở đây
};

export default func;
```

**Kiểm tra gas với `hardhat-gas-reporter`:**

```bash
REPORT_GAS=true npm run test
npm run size   # kiểm tra contract size — giới hạn 24KB
```

> **Milestone Phase 1:** 4 contract deploy được, test coverage > 90%, gas report không có function nào > 200k gas.

---

## Phase 2 — Off-chain & Storage Layer (Tuần 5–8)

**Mục tiêu:** Kết nối smart contract với IPFS và backend Node.js. File mã hóa, hash lưu on-chain.

### Tuần 5 — IPFS với Pinata

```bash
npm install @pinata/sdk
```

```typescript
// services/ipfs.service.ts
import PinataSDK from "@pinata/sdk";

const pinata = new PinataSDK(
  process.env.PINATA_API_KEY!,
  process.env.PINATA_SECRET!,
);

export async function uploadToIPFS(encryptedData: Buffer): Promise<string> {
  const result = await pinata.pinFileToIPFS(encryptedData);
  return result.IpfsHash; // CID
}

export async function fetchFromIPFS(cid: string): Promise<Buffer> {
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  return Buffer.from(await response.arrayBuffer());
}
```

**Flow upload hoàn chỉnh:**

```
File gốc
  → AES-256 encrypt (key ngẫu nhiên)
  → Upload lên IPFS → nhận CID
  → SHA-256 hash file gốc
  → Gọi RecordRegistry.addRecord(patientDID, CID, hash, recordType)
  → AES key → RSA encrypt bằng public key bệnh nhân → lưu cùng metadata
```

---

### Tuần 6 — Mã hóa dữ liệu

```bash
npm install crypto-js @types/crypto-js
```

```typescript
// services/crypto.service.ts
import CryptoJS from "crypto-js";
import { ethers } from "ethers";

// Mã hóa file trước khi upload IPFS
export function encryptFile(fileBuffer: Buffer): {
  encrypted: string;
  key: string;
} {
  const key = CryptoJS.lib.WordArray.random(32).toString(); // AES-256 key
  const encrypted = CryptoJS.AES.encrypt(
    CryptoJS.lib.WordArray.create(fileBuffer),
    key,
  ).toString();
  return { encrypted, key };
}

// Giải mã sau khi fetch từ IPFS
export function decryptFile(encryptedData: string, key: string): Buffer {
  const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
  return Buffer.from(decrypted.toString(CryptoJS.enc.Hex), "hex");
}

// Hash để lưu on-chain
export function hashFile(fileBuffer: Buffer): string {
  return ethers.keccak256(fileBuffer);
}

// Verify khi fetch về
export function verifyIntegrity(
  fileBuffer: Buffer,
  onChainHash: string,
): boolean {
  return hashFile(fileBuffer) === onChainHash;
}
```

**Tìm hiểu thêm:** [Lit Protocol](https://developer.litprotocol.com) — xử lý access control + encryption tự động, thay thế cho việc tự quản lý key.

---

### Tuần 7 — Backend Node.js / Express

```bash
npm install express ethers dotenv
npm install -D @types/express ts-node typescript
```

```typescript
// app.ts — API endpoints cần build

// POST /records
// Body: { patientDID, file (multipart), recordType }
// Flow: verify JWT → encrypt file → upload IPFS → gọi contract addRecord

// GET /records/:patientDID
// Flow: check hasAccess on-chain → nếu có → fetch IPFS → decrypt → trả về

// POST /access/grant
// Body: { patientDID, doctorAddress, durationHours, dataTypes }
// Flow: verify caller là patient → gọi contract grantAccess

// GET /audit/:patientDID
// Flow: query auditLog contract → trả về danh sách ai đã truy cập

// Dùng Ethers.js v6 để gọi contract từ backend:
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
```

---

### Tuần 8 — Integration Phase 2

- [✅] Upload file thật → encrypt → IPFS → hash on-chain
- [✅] Fetch về → verify hash → decrypt → file khớp bản gốc
- [✅] API test với Supertest
- [✅] Handle edge cases: file > 100MB, CID không tồn tại, IPFS gateway timeout
- [✅] Retry logic cho IPFS request

> **Milestone Phase 2:** End-to-end qua API — upload → lưu chain → fetch → decrypt thành công.

---

## Phase 3 — Frontend & Integration (Tuần 9–12)

**Mục tiêu:** Build UI cho bệnh nhân và bác sĩ. Kết nối MetaMask. Chạy end-to-end từ browser.

### Tuần 9 — Ethers.js v6 & Wallet

```bash
npm install ethers wagmi @rainbow-me/rainbowkit
```

```typescript
// hooks/useContract.ts — dùng Ethers.js v6
import { ethers, BrowserProvider, Contract } from "ethers";
import RecordRegistryABI from "../abi/RecordRegistry.json";

export function useContract() {
  const getContract = async () => {
    // Ethers v6: dùng BrowserProvider thay vì Web3Provider
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, RecordRegistryABI, signer);
  };

  return { getContract };
}
```

**Lưu ý Ethers.js v6** — có breaking changes so với v5:

| v5                              | v6                       |
| ------------------------------- | ------------------------ |
| `ethers.providers.Web3Provider` | `ethers.BrowserProvider` |
| `ethers.utils.parseEther()`     | `ethers.parseEther()`    |
| `BigNumber`                     | `bigint` native          |
| `provider.getGasPrice()`        | `provider.getFeeData()`  |

---

### Tuần 10 — Patient App

Màn hình cần build:

- **Onboarding:** Đăng ký DID lần đầu, lưu public key
- **Dashboard:** Danh sách hồ sơ của mình, badge loại hồ sơ
- **Grant Access:** Nhập địa chỉ bác sĩ, chọn `dataTypes[]`, đặt thời hạn
- **Audit Log:** Timeline ai đã xem hồ sơ mình, lúc nào
- **View Record:** Fetch từ IPFS → decrypt → hiển thị file

---

### Tuần 11 — Doctor Portal

Màn hình cần build:

- **Search Patient:** Tìm theo DID hoặc quét QR code
- **Record List:** Chỉ hiện nếu `hasAccess()` = true, báo lỗi rõ nếu không có quyền
- **Upload Record:** Chọn file → encrypt → IPFS → gọi `addRecord()`
- **Emergency Access:** Button kèm input lý do, confirm dialog

---

### Tuần 12 — Polish & Integration

- [ ] Loading states cho mọi transaction (pending → success/fail)
- [ ] Handle MetaMask chưa cài, sai network → hướng dẫn switch sang Sepolia
- [ ] Mobile responsive
- [ ] Viết README đủ để người khác chạy được project

> **Milestone Phase 3:** Demo end-to-end — bệnh nhân cấp quyền → bác sĩ xem hồ sơ thành công.

---

## Phase 4 — Deploy & Hardening (Tuần 13–16)

**Mục tiêu:** Deploy lên Sepolia testnet (đúng với config `run:sepolia` trong package.json). Security audit. Demo-ready.

### Tuần 13 — Deploy lên Sepolia

```bash
# hardhat.config.ts — thêm Sepolia network
networks: {
  sepolia: {
    url: process.env.SEPOLIA_RPC_URL,  // từ Alchemy hoặc Infura
    accounts: [process.env.PRIVATE_KEY!]
  }
}
```

```bash
# Deploy
npm run run:sepolia -- scripts/deploy.ts

# Verify contract source trên Etherscan
npx hardhat verify --network sepolia DEPLOYED_CONTRACT_ADDRESS
```

- [ ] Lấy Sepolia ETH từ faucet: [sepoliafaucet.com](https://sepoliafaucet.com)
- [ ] Verify 4 contract trên Etherscan — người dùng đọc được source code
- [ ] Update frontend `.env` với Sepolia contract addresses
- [ ] Test toàn bộ flow trên testnet thật

---

### Tuần 14 — Security Audit

**Dùng Slither** (static analyzer):

```bash
pip install slither-analyzer
slither . --exclude-dependencies
```

**Checklist thủ công:**

- [ ] **Reentrancy:** Mọi function chuyển ETH/token đều có `ReentrancyGuard` (đã import từ OZ)
- [ ] **Access Control:** Mọi function sensitive đều có modifier check role
- [ ] **Integer Overflow:** Solidity ≥ 0.8.0 tự revert — nhưng vẫn check logic
- [ ] **Front-running:** Các thao tác grant/revoke có bị MEV không?
- [ ] **Upgradeable contracts:** Nếu dùng `@openzeppelin/contracts-upgradeable`, check storage layout
- [ ] **Chainlink:** Nếu dùng `@chainlink/contracts` cho price feed, check freshness của data

**Chainlink** (đã có trong dependencies) có thể dùng để:

- Verify timestamp từ oracle thay vì `block.timestamp` (chống miner manipulation)
- Price feed nếu sau này có payment feature

---

### Tuần 15 — Monitoring & DevOps

```bash
# The Graph — index blockchain events để query nhanh
npm install @graphprotocol/graph-cli

# Định nghĩa schema cho AccessGranted, RecordAdded events
# Deploy subgraph lên The Graph hosted service (miễn phí cho testnet)
```

**CI/CD với GitHub Actions:**

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: "18" }
      - run: npm ci
      - run: npm run compile
      - run: npm run test
```

---

### Tuần 16 — Demo Preparation

- [ ] Deploy frontend lên Vercel
- [ ] Chuẩn bị test data thực tế (hồ sơ giả nhưng trông thật)
- [ ] Demo script 5 phút: vấn đề → giải pháp → live demo → Q&A
- [ ] Slide deck: kiến trúc + business case
- [ ] Record demo video làm backup

> **Milestone cuối:** Hệ thống chạy trên Sepolia, demo live được, README đủ để clone và chạy.

---

## Tài nguyên học tập

### Solidity & Hardhat

| Tên                       | Link                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| Hardhat Docs              | [hardhat.org](https://hardhat.org)                                                       |
| OpenZeppelin Contracts v5 | [docs.openzeppelin.com](https://docs.openzeppelin.com/contracts/5.x)                     |
| OpenZeppelin Upgradeable  | [docs.openzeppelin.com/upgrades-plugins](https://docs.openzeppelin.com/upgrades-plugins) |
| Solidity by Example       | [solidity-by-example.org](https://solidity-by-example.org)                               |
| Hardhat Network Helpers   | [hardhat.org/hardhat-network-helpers](https://hardhat.org/hardhat-network-helpers)       |

### Ethers.js v6

| Tên                     | Link                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| Ethers.js v6 Docs       | [docs.ethers.org/v6](https://docs.ethers.org/v6)                     |
| Migration guide v5 → v6 | [docs.ethers.org/v6/migrating](https://docs.ethers.org/v6/migrating) |
| Wagmi (React hooks)     | [wagmi.sh](https://wagmi.sh)                                         |

### Storage & Security

| Tên                 | Link                                                           |
| ------------------- | -------------------------------------------------------------- |
| Pinata (IPFS)       | [pinata.cloud](https://pinata.cloud)                           |
| Lit Protocol        | [developer.litprotocol.com](https://developer.litprotocol.com) |
| Slither             | [github.com/crytic/slither](https://github.com/crytic/slither) |
| Secureum (Security) | [secureum.substack.com](https://secureum.substack.com)         |

### Deploy & Monitoring

| Tên               | Link                                                 |
| ----------------- | ---------------------------------------------------- |
| Alchemy (RPC)     | [alchemy.com](https://alchemy.com)                   |
| Sepolia Faucet    | [sepoliafaucet.com](https://sepoliafaucet.com)       |
| Sepolia Etherscan | [sepolia.etherscan.io](https://sepolia.etherscan.io) |
| The Graph         | [thegraph.com](https://thegraph.com)                 |

---

## Thói quen học hàng ngày

| Ngày        | Hoạt động                             | Thời gian |
| ----------- | ------------------------------------- | --------- |
| Thứ 2, 4, 6 | Code — implement task của tuần        | 2 giờ     |
| Thứ 3, 5    | Đọc docs + xem tutorial               | 1.5 giờ   |
| Thứ 7       | Review, refactor, viết test           | 3 giờ     |
| Chủ nhật    | Nghỉ hoặc đọc về kiến trúc / security | Tuỳ ý     |

**Nguyên tắc khi bị stuck:**

- Đọc kỹ error message — 80% lỗi Solidity có thông báo rõ ràng
- Google: `[tên lỗi] solidity hardhat` — Stack Overflow và GitHub Issues là bạn
- [Ethereum StackExchange](https://ethereum.stackexchange.com) — chuyên về Solidity
- Stuck > 30 phút → ghi lại vấn đề, làm task khác, quay lại sau
- **Build nhỏ, test thường xuyên** — đừng viết 200 dòng rồi mới test

---

> **Bắt đầu với `HealthAccessControl.sol`** — contract quan trọng và thách thức nhất.  
> Làm được contract đó là bạn đã hiểu 60% hệ thống.
