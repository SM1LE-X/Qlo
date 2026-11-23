// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title HealthRecords
/// @notice Patient-owned encrypted record registry, ECDH wrapped DEK grants, instant revocation, and audit log.
contract HealthRecords {
    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint64 public constant MIN_GRANT_DURATION = 60;
    uint64 public constant MAX_GRANT_DURATION = 30 days;

    struct Record {
        address patient;
        bytes32 recordCommitment;
        string cid;
        uint64 createdAt;
        bool exists;
    }

    struct AccessGrant {
        uint64 expiresAt;
        bytes encryptedDek;
    }

    uint256 public nextRecordId = 1;
    mapping(uint256 => Record) private _records;
    mapping(bytes32 => uint256) public commitmentToRecordId;
    mapping(uint256 => mapping(address => AccessGrant)) private _grants;
    mapping(address => uint256[]) private _patientRecordIds;

    error InvalidRecordCommitment();
    error DuplicateRecordCommitment();
    error EmptyCid();
    error CidTooLong();
    error RecordNotFound();
    error NotRecordOwner();
    error ZeroAddress();
    error InvalidDuration();
    error EmptyEncryptedDek();
    error EncryptedDekTooLong();
    error AccessDeniedOrExpired();

    event RecordRegistered(
        uint256 indexed recordId,
        address indexed patient,
        bytes32 indexed recordCommitment,
        string cid,
        uint64 createdAt
    );
    event AccessGranted(
        uint256 indexed recordId,
        address indexed patient,
        address indexed hospital,
        uint64 expiresAt
    );
    event AccessRevoked(
        uint256 indexed recordId,
        address indexed patient,
        address indexed hospital,
        uint64 revokedAt
    );
    event RecordAccessed(
        uint256 indexed recordId,
        address indexed hospital,
        uint64 accessedAt
    );

    function registerRecord(bytes32 recordCommitment, string calldata cid) external returns (uint256 recordId) {
        uint256 commitInt = uint256(recordCommitment);
        if (commitInt == 0 || commitInt >= SNARK_SCALAR_FIELD) revert InvalidRecordCommitment();
        if (commitmentToRecordId[recordCommitment] != 0) revert DuplicateRecordCommitment();

        uint256 cidLen = bytes(cid).length;
        if (cidLen == 0) revert EmptyCid();
        if (cidLen > 128) revert CidTooLong();

        recordId = nextRecordId++;
        uint64 nowTs = uint64(block.timestamp);
        _records[recordId] = Record({
            patient: msg.sender,
            recordCommitment: recordCommitment,
            cid: cid,
            createdAt: nowTs,
            exists: true
        });
        commitmentToRecordId[recordCommitment] = recordId;
        _patientRecordIds[msg.sender].push(recordId);

        emit RecordRegistered(recordId, msg.sender, recordCommitment, cid, nowTs);
    }

    function grantAccess(
        uint256 recordId,
        address hospital,
        uint64 durationSeconds,
        bytes calldata encryptedDek
    ) external {
        Record storage rec = _records[recordId];
        if (!rec.exists) revert RecordNotFound();
        if (rec.patient != msg.sender) revert NotRecordOwner();
        if (hospital == address(0)) revert ZeroAddress();
        if (durationSeconds < MIN_GRANT_DURATION || durationSeconds > MAX_GRANT_DURATION) {
            revert InvalidDuration();
        }
        if (encryptedDek.length == 0) revert EmptyEncryptedDek();
        if (encryptedDek.length > 512) revert EncryptedDekTooLong();

        uint64 expiresAt = uint64(block.timestamp) + durationSeconds;
        _grants[recordId][hospital] = AccessGrant({
            expiresAt: expiresAt,
            encryptedDek: encryptedDek
        });

        emit AccessGranted(recordId, msg.sender, hospital, expiresAt);
    }

    function revokeAccess(uint256 recordId, address hospital) external {
        Record storage rec = _records[recordId];
        if (!rec.exists) revert RecordNotFound();
        if (rec.patient != msg.sender) revert NotRecordOwner();
        if (hospital == address(0)) revert ZeroAddress();

        _grants[recordId][hospital].expiresAt = 0;
        delete _grants[recordId][hospital].encryptedDek;

        emit AccessRevoked(recordId, msg.sender, hospital, uint64(block.timestamp));
    }

    function logAccess(uint256 recordId) external {
        if (!hasActiveAccess(recordId, msg.sender)) revert AccessDeniedOrExpired();
        emit RecordAccessed(recordId, msg.sender, uint64(block.timestamp));
    }

    function hasActiveAccess(uint256 recordId, address hospital) public view returns (bool) {
        if (!_records[recordId].exists) return false;
        return _grants[recordId][hospital].expiresAt > block.timestamp;
    }

    function hasActiveAccessByCommitment(bytes32 recordCommitment, address hospital) external view returns (bool) {
        uint256 recordId = commitmentToRecordId[recordCommitment];
        if (recordId == 0) return false;
        return hasActiveAccess(recordId, hospital);
    }

    function getGrant(
        uint256 recordId,
        address hospital
    ) external view returns (uint64 expiresAt, bytes memory encryptedDek) {
        AccessGrant storage grant = _grants[recordId][hospital];
        if (!_records[recordId].exists || grant.expiresAt <= block.timestamp) {
            return (0, bytes(""));
        }
        return (grant.expiresAt, grant.encryptedDek);
    }

    function getRecord(uint256 recordId) external view returns (Record memory) {
        if (!_records[recordId].exists) revert RecordNotFound();
        return _records[recordId];
    }

    function getRecordsByPatient(address patient) external view returns (Record[] memory results) {
        uint256[] storage ids = _patientRecordIds[patient];
        results = new Record[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            results[i] = _records[ids[i]];
        }
    }

    function getRecordIdsByPatient(address patient) external view returns (uint256[] memory) {
        return _patientRecordIds[patient];
    }
}
