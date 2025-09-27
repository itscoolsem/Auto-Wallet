// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20Base} from "./ERC20Base.sol";
import {Ownable} from "../utils/Ownable.sol";
import {IUSDXOFT} from "../interfaces/IUSDXOFT.sol";
import {ILayerZeroEndpointV2} from "../interfaces/ILayerZeroEndpointV2.sol";
import {IDestChainExecutor} from "../interfaces/IDestChainExecutor.sol";

/// @title USDXOFT
/// @notice LayerZero-based omnichain stablecoin used as the universal bridge asset.
contract USDXOFT is ERC20Base, Ownable, IUSDXOFT {
    ILayerZeroEndpointV2 public immutable endpoint;

    mapping(uint32 => bytes32) public peers;

    event PeerSet(uint32 indexed eid, bytes32 peer);
    event OFTSent(
        bytes32 indexed messageId, uint32 indexed dstEid, address indexed from, address executor, uint256 amount
    );
    event OFTReceived(uint32 indexed srcEid, address indexed from, address indexed executor, uint256 amount);

    error PeerNotSet(uint32 eid);
    error InvalidEndpoint();

    struct Envelope {
        bytes32 executor;
        address sender;
        uint256 amount;
        bytes payload;
    }

    constructor(address owner_, ILayerZeroEndpointV2 endpoint_, string memory name_, string memory symbol_)
        ERC20Base(name_, symbol_, 18)
        Ownable(owner_)
    {
        if (address(endpoint_) == address(0)) revert InvalidEndpoint();
        endpoint = endpoint_;
    }

    function setPeer(uint32 eid, bytes32 peerAddr) external override onlyOwner {
        peers[eid] = peerAddr;
        emit PeerSet(eid, peerAddr);
    }

    function peer(uint32 eid) external view override returns (bytes32) {
        return peers[eid];
    }

    function send(SendParam calldata param, address payable refundAddress)
        external
        payable
        override
        returns (SendResult memory result)
    {
        bytes32 peerAddr = peers[param.dstEid];
        if (peerAddr == bytes32(0)) revert PeerNotSet(param.dstEid);

        _burn(msg.sender, param.amount);

        Envelope memory envelope =
            Envelope({executor: param.to, sender: msg.sender, amount: param.amount, payload: param.payload});

        bytes32 messageId = endpoint.send{value: msg.value}(
            param.dstEid, peerAddr, abi.encode(envelope), param.options, param.fee, refundAddress
        );

        emit OFTSent(messageId, param.dstEid, msg.sender, _bytes32ToAddress(param.to), param.amount);
        result = SendResult({messageId: messageId, amountSent: param.amount});
    }

    function lzReceive(uint32 srcEid, bytes32 from, bytes calldata message) external {
        if (msg.sender != address(endpoint)) revert InvalidEndpoint();
        if (peers[srcEid] != from) revert PeerNotSet(srcEid);

        Envelope memory envelope = abi.decode(message, (Envelope));
        address executor = _bytes32ToAddress(envelope.executor);

        _mint(executor, envelope.amount);
        emit OFTReceived(srcEid, envelope.sender, executor, envelope.amount);

        if (envelope.payload.length > 0) {
            IDestChainExecutor(executor).onOFTReceived(srcEid, from, address(this), envelope.amount, envelope.payload);
        }
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    function _bytes32ToAddress(bytes32 data) private pure returns (address addr) {
        addr = address(uint160(uint256(data)));
    }
}
