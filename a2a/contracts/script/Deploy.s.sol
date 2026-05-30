// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "../src/AgentEscrow.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        AgentEscrow escrow = new AgentEscrow();
        console.log("AgentEscrow deployed at:", address(escrow));
        vm.stopBroadcast();
    }
}
