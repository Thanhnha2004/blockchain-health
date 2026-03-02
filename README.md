# MedChain — Blockchain Health Records

Hệ thống hồ sơ y tế phi tập trung. Bệnh nhân kiểm soát quyền truy cập dữ liệu của mình. Bác sĩ chỉ xem được hồ sơ khi được cấp quyền.

## Tech Stack

| Layer           | Tech                                              |
| --------------- | ------------------------------------------------- |
| Smart Contracts | Solidity 0.8.28, Hardhat, OpenZeppelin            |
| Storage         | IPFS (Pinata)                                     |
| Encryption      | AES-256-CBC, keccak256                            |
| Backend         | Node.js, Express, Ethers.js v6                    |
| Frontend        | Next.js 15, wagmi v2, RainbowKit, Tailwind CSS v3 |

## Yêu cầu

- Node.js >= 18
- MetaMask browser extension
- Pinata account (miễn phí tại pinata.cloud)

## Cài đặt

```bash
git clone <repo-url>
cd blockchain-health

# Cài dependencies root (contracts)
npm install

# Cài dependencies backend
cd backend && npm install && cd ..

# Cài dependencies frontend
cd frontend && npm install && cd ..
```

## Chạy local

### 1. Khởi động Hardhat node

```bash
npx hardhat node
```

Giữ terminal này mở. Hardhat sẽ in ra 20 địa chỉ test kèm private key.

### 2. Deploy contracts

Mở terminal mới:

```bash
npm run deploy:local
```

Script tự động deploy và cập nhật địa chỉ vào `backend/.env` và `frontend/.env.local`.

### 3. Cấu hình backend

Tạo file `backend/.env`:

```env
RPC_URL=http://127.0.0.1:8545
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET=your_pinata_secret

PORT=3001

# Tự động điền bởi npm run deploy:local
DID_REGISTRY_ADDRESS=
ACCESS_CONTROL_ADDRESS=
AUDIT_LOG_ADDRESS=
RECORD_REGISTRY_ADDRESS=
```

> **Lưu ý:** `PRIVATE_KEY` trên là Account #0 của Hardhat — chỉ dùng cho local. Backend dùng key này để gọi `addRecord()` thay mặt bác sĩ. Khi deploy production phải thay bằng key riêng.

### 4. Chạy backend

```bash
cd backend
npx ts-node src/app.ts
```

### 5. Cấu hình frontend

Tạo file `frontend/.env.local`:

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_API_URL=http://localhost:3001

# Tự động điền bởi npm run deploy:local
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=
NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS=
NEXT_PUBLIC_AUDIT_LOG_ADDRESS=
NEXT_PUBLIC_RECORD_REGISTRY_ADDRESS=
```

### 6. Chạy frontend

```bash
cd frontend
npm run dev
```

Mở http://localhost:3000

## Cấu hình MetaMask

1. Thêm network Hardhat:

   - Network name: `Hardhat`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `ETH`

2. Import tài khoản test:
   - Account #0 (Bệnh nhân / Backend signer): `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
   - Account #1 (Bác sĩ): `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

## Demo end-to-end

### Bước 1 — Bệnh nhân đăng ký

1. Truy cập http://localhost:3000/patient
2. Connect wallet bằng **Account #0**
3. Đăng ký DID — điền RSA public key và service endpoint
4. Tab **Access** → Grant access cho địa chỉ bác sĩ (Account #1) và backend (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`)

### Bước 2 — Bác sĩ upload hồ sơ

1. Truy cập http://localhost:3000/doctor
2. Connect wallet bằng **Account #1**
3. Tìm bệnh nhân bằng địa chỉ ví Account #0
4. Tab **Upload** → chọn file → chọn loại hồ sơ → Upload & Sign
5. **Lưu lại AES key** hiển thị sau khi upload thành công — cần để giải mã file

### Bước 3 — Bệnh nhân xem hồ sơ

1. Quay lại http://localhost:3000/patient với Account #0
2. Tab **Records** → danh sách hồ sơ hiện ra
3. Click **View** trên record → nhập AES key → Decrypt & View
4. Tab **Audit** → xem lịch sử ai đã tạo/xem hồ sơ

### Bước 4 — Bác sĩ xem hồ sơ

1. Ở doctor portal → tab **Records** → danh sách hiện nếu đã được grant access
2. Click **View** → nhập AES key của record đó

## Cấu trúc project

```
blockchain-health/
├── contracts/
│   ├── DIDRegistry.sol          # Quản lý DID của bệnh nhân/bác sĩ
│   ├── HealthAccessControl.sol  # Cấp/thu hồi quyền truy cập
│   ├── AuditLog.sol             # Ghi lịch sử truy cập
│   └── RecordRegistry.sol       # Lưu metadata hồ sơ on-chain
├── deploy/                      # Hardhat deploy scripts (00-04)
├── test/                        # Contract tests + integration tests
├── scripts/
│   └── sync-env.ts              # Tự động cập nhật .env sau deploy
├── backend/
│   └── src/
│       ├── services/
│       │   ├── crypto.service.ts   # AES-256 encrypt/decrypt
│       │   ├── ipfs.service.ts     # Upload/fetch Pinata IPFS
│       │   └── contract.service.ts # Ethers.js contract instances
│       ├── routes/
│       │   ├── records.router.ts   # POST /records, GET /records/:did
│       │   └── access.router.ts    # POST /access/grant, GET /audit
│       └── app.ts
└── frontend/
    ├── app/
    │   ├── patient/             # Patient portal (/patient)
    │   │   ├── page.tsx
    │   │   ├── onboarding.tsx
    │   │   ├── dashboard.tsx
    │   │   ├── grant-access.tsx
    │   │   ├── audit-log.tsx
    │   │   └── view-record.tsx
    │   └── doctor/              # Doctor portal (/doctor)
    │       ├── page.tsx
    │       ├── search-patient.tsx
    │       ├── record-list.tsx
    │       ├── upload-record.tsx
    │       └── emergency-access.tsx
    ├── components/
    │   ├── providers.tsx        # WagmiProvider + RainbowKit + Toast
    │   ├── toast.tsx            # Transaction notifications
    │   └── network-guard.tsx    # MetaMask + network check
    ├── hooks/
    │   ├── useContracts.ts      # Ethers Contract instances từ wallet
    │   ├── useDID.ts            # registerDID, getMyDID
    │   └── useAccess.ts         # grantAccess, revokeAccess, audit
    └── lib/
        └── wagmi.config.ts      # Chain config

```

## Chạy tests

```bash
# Contract tests
npx hardhat test

# Backend tests
cd backend && npm test
```

## Giới hạn hiện tại (TODO)

- **AES key exchange** — hiện tại bác sĩ giữ key và share thủ công cho bệnh nhân. Cần implement RSA encrypt key bằng public key bệnh nhân (lưu trong DIDRegistry) để bệnh nhân tự decrypt.
- **JWT authentication** — backend chưa verify danh tính caller, chỉ check on-chain access.
- **Emergency access UI** — component đã có nhưng chưa tích hợp vào doctor portal.

## Lưu ý bảo mật

- `backend/.env` và `frontend/.env.local` đã có trong `.gitignore` — không commit lên git
- Private key hardhat chỉ dùng cho local development
- Khi deploy production: dùng private key riêng, không dùng key hardhat
