// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {RouteTypes} from "./RouteTypes.sol";
import {WalletExecutor} from "./WalletExecutor.sol";
import {IEntryPoint} from "../interfaces/IEntryPoint.sol";

/// @title AutoBridgePaymaster
/// @notice ERC-4337 paymaster that sponsors wallet executor routes for approved smart accounts.
contract AutoBridgePaymaster {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    enum PostOpMode {
        opSucceeded,
        opReverted,
        postOpReverted
    }

    struct SenderConfig {
        bool allowed;
        address expectedUser;
    }

    address public owner;
    address public immutable entryPoint;
    address public gasVault;
    address public walletExecutor;
    uint256 public maxSponsoredCost;
    bool public allowAnySender = true;

    mapping(address => SenderConfig) public senderConfigs;

    event Sponsored(address indexed sender, uint256 maxCost);
    event GasVaultUpdated(address indexed vault);
    event Deposited(uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event WalletExecutorUpdated(address indexed executor);
    event SenderPermissionUpdated(address indexed smartAccount, address indexed user, bool allowed);
    event MaxSponsoredCostUpdated(uint256 maxCost);
    event AllowAnySenderUpdated(bool allowAnySender);

    error NotOwner();
    error InvalidEntryPoint();
    error SenderNotAllowed(address smartAccount);
    error InvalidTarget(address target);
    error InvalidCalldata();
    error InvalidRouteUser(address routeUser, address expected);
    error GasLimitTooHigh(uint256 requested, uint256 limit);
    error InvalidAccountCalldata();
    error InvalidExecutorSelector();
    error InvalidRouteAmount();

    bytes4 private constant EXECUTE_SELECTOR = bytes4(keccak256("execute(address,uint256,bytes)"));
    bytes4 private constant EXECUTE_ROUTE_SELECTOR = WalletExecutor.executeRoute.selector;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _owner, address _entryPoint, address _gasVault) {
        owner = _owner;
        entryPoint = _entryPoint;
        gasVault = _gasVault;
    }

    function setGasVault(address vault) external onlyOwner {
        gasVault = vault;
        emit GasVaultUpdated(vault);
    }

    function setWalletExecutor(address executor) external onlyOwner {
        walletExecutor = executor;
        emit WalletExecutorUpdated(executor);
    }

    function setSenderPermission(address smartAccount, address user, bool allowed) external onlyOwner {
        senderConfigs[smartAccount] = SenderConfig({allowed: allowed, expectedUser: user});
        emit SenderPermissionUpdated(smartAccount, user, allowed);
    }

    function setMaxSponsoredCost(uint256 maxCost) external onlyOwner {
        maxSponsoredCost = maxCost;
        emit MaxSponsoredCostUpdated(maxCost);
    }

    function setAllowAnySender(bool value) external onlyOwner {
        allowAnySender = value;
        emit AllowAnySenderUpdated(value);
    }

    function deposit() external payable onlyOwner {
        IEntryPoint(entryPoint).depositTo{value: msg.value}(address(this));
        emit Deposited(msg.value);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        IEntryPoint(entryPoint).withdrawTo(to, amount);
        emit Withdrawn(to, amount);
    }

    function validatePaymasterUserOp(UserOperation calldata userOp, bytes32, uint256 maxCost)
        external
        returns (bytes memory context, uint256 validationData)
    {
        if (msg.sender != entryPoint) revert InvalidEntryPoint();
        if (maxSponsoredCost != 0 && maxCost > maxSponsoredCost) {
            revert GasLimitTooHigh(maxCost, maxSponsoredCost);
        }

        SenderConfig memory config = senderConfigs[userOp.sender];
        bool senderAllowed = allowAnySender || config.allowed;
        if (!senderAllowed) revert SenderNotAllowed(userOp.sender);

        (address target, uint256 value, bytes memory executorCalldata) = _decodeAccountCall(userOp.callData);
        if (target != walletExecutor) revert InvalidTarget(target);
        if (value != 0) revert InvalidCalldata();

        _validateExecutorCalldata(executorCalldata, senderAllowed ? config.expectedUser : address(0));

        emit Sponsored(userOp.sender, maxCost);
        return (bytes(""), 0);
    }

    function postOp(PostOpMode, bytes calldata, uint256, uint256) external {
        if (msg.sender != entryPoint) revert InvalidEntryPoint();
    }

    receive() external payable {}

    function _decodeAccountCall(bytes calldata callData)
        private
        pure
        returns (address target, uint256 value, bytes memory data)
    {
        bytes memory callDataMem = callData;
        if (callDataMem.length < 4) revert InvalidAccountCalldata();
        uint32 sig;
        for (uint256 i = 0; i < 4; i++) {
            sig = (sig << 8) | uint32(uint8(callDataMem[i]));
        }
        bytes4 selector = bytes4(sig);
        if (selector != EXECUTE_SELECTOR) revert InvalidAccountCalldata();

        bytes memory tail = _slice(callDataMem, 4);
        (target, value, data) = abi.decode(tail, (address, uint256, bytes));
    }

    function _validateExecutorCalldata(bytes memory executorCalldata, address expectedUser) private pure {
        if (executorCalldata.length < 4) revert InvalidExecutorSelector();
        uint32 sig;
        for (uint256 i = 0; i < 4; i++) {
            sig = (sig << 8) | uint32(uint8(executorCalldata[i]));
        }
        bytes4 selector = bytes4(sig);
        if (selector != EXECUTE_ROUTE_SELECTOR) revert InvalidExecutorSelector();

        bytes memory payload = new bytes(executorCalldata.length - 4);
        for (uint256 i = 4; i < executorCalldata.length; i++) {
            payload[i - 4] = executorCalldata[i];
        }

        RouteTypes.RouteInput memory route = abi.decode(payload, (RouteTypes.RouteInput));
        if (expectedUser != address(0) && route.user != expectedUser) {
            revert InvalidRouteUser(route.user, expectedUser);
        }
        if (route.tokenIn == address(0) || route.amountIn == 0) {
            revert InvalidRouteAmount();
        }
    }

    function _slice(bytes memory data, uint256 start) private pure returns (bytes memory result) {
        require(data.length >= start, "slice overflow");
        uint256 len = data.length - start;
        result = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = data[i + start];
        }
    }
}
