// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract MockEntryPoint {
    mapping(address => uint256) public deposits;

    function depositTo(address account) external payable {
        deposits[account] += msg.value;
    }

    function withdrawTo(address payable withdrawAddress, uint256 amount) external {
        uint256 current = deposits[msg.sender];
        require(current >= amount, "insufficient deposit");
        deposits[msg.sender] = current - amount;
        withdrawAddress.transfer(amount);
    }

    function getNonce(address, uint192) external pure returns (uint256) {
        return 0;
    }

    receive() external payable {}
}
