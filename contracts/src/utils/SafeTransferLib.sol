// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title SafeTransferLib
/// @notice Lightweight helpers for safe ERC20 and ETH transfers.
library SafeTransferLib {
    error TransferFailed();

    function safeTransfer(address token, address to, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(0xa9059cbb, to, amount));
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(0x23b872dd, from, to, amount));
    }

    function safeApprove(address token, address spender, uint256 amount) internal {
        _call(token, abi.encodeWithSelector(0x095ea7b3, spender, amount));
    }

    function safeTransferETH(address to, uint256 amount) internal {
        (bool success,) = to.call{value: amount}(new bytes(0));
        if (!success) revert TransferFailed();
    }

    function _call(address token, bytes memory data) private {
        (bool success, bytes memory returndata) = token.call(data);
        if (!success || (returndata.length != 0 && !abi.decode(returndata, (bool)))) revert TransferFailed();
    }
}
