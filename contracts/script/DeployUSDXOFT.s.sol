// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {USDXOFT} from "../src/tokens/USDXOFT.sol";
import {ILayerZeroEndpointV2} from "../src/interfaces/ILayerZeroEndpointV2.sol";

/// @notice Deploys the omnichain USDX token for Base Sepolia using LayerZero v2.
/// @dev Run with:
/// ```
/// cd contracts/deployment
/// PRIVATE_KEY=0x... \
/// LZ_ENDPOINT=0x... \
/// DEPLOY_USDX_INITIAL_MINT=1000000e18 \
/// forge script script/DeployUSDXOFT.s.sol \
///   --rpc-url $BASE_SEPOLIA_RPC \
///   --broadcast -vvvv
/// ```
/// Required env vars:
///   PRIVATE_KEY   - deployer private key
///   LZ_ENDPOINT   - LayerZero Endpoint V2 address for the chain
/// Optional env vars:
///   USDX_OWNER    - owner address to manage minting/peer config (defaults to deployer)
///   USDX_NAME     - token name (defaults "AutoBridge USDX")
///   USDX_SYMBOL   - token symbol (defaults "USDX")
///   USDX_MINT_TO  - address to receive initial supply (defaults owner)
///   USDX_MINT_AMOUNT - amount (wei) to mint initially (defaults 0)
contract DeployUSDXOFT is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address endpoint = vm.envAddress("LZ_ENDPOINT");

        address owner = vm.envOr("USDX_OWNER", vm.addr(deployerPk));
        string memory name = vm.envOr("USDX_NAME", string("AutoBridge USDX"));
        string memory symbol = vm.envOr("USDX_SYMBOL", string("USDX"));

        address mintTo = vm.envOr("USDX_MINT_TO", owner);
        uint256 mintAmount = vm.envOr("USDX_MINT_AMOUNT", uint256(0));

        vm.startBroadcast(deployerPk);

        USDXOFT usdx = new USDXOFT(owner, ILayerZeroEndpointV2(endpoint), name, symbol);

        if (mintAmount > 0) {
            usdx.mint(mintTo, mintAmount);
        }

        vm.stopBroadcast();

        console2.log("USDXOFT", address(usdx));
        console2.log("Owner", owner);
        console2.log("LayerZero endpoint", endpoint);
        if (mintAmount > 0) {
            console2.log("Initial mint", mintAmount);
            console2.log("Mint recipient", mintTo);
        }
    }
}
