// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Test.sol";
import "../src/AgentEscrow.sol";

contract AgentEscrowTest is Test {
    AgentEscrow escrow;

    address agentA = makeAddr("agentA");
    address agentB = makeAddr("agentB");
    address agentA2 = makeAddr("agentA2");
    address agentA3 = makeAddr("agentA3");

    bytes32 constant COMMIT = keccak256("task-spec");
    bytes32 constant REPORT = keccak256("report");
    uint256 constant AMOUNT = 0.1 ether;

    function setUp() public {
        escrow = new AgentEscrow();
        vm.deal(agentA, 1 ether);
        vm.deal(agentA2, 1 ether);
        vm.deal(agentA3, 1 ether);
        vm.deal(agentB, 1 ether);
    }

    function _lockSingle(bytes32 taskId, address funder) internal {
        vm.prank(funder);
        escrow.lockFunds{value: AMOUNT}(taskId, agentB, COMMIT);
    }

    function _lockRace(bytes32 taskId, address funder, bytes32 resourceId) internal {
        vm.prank(funder);
        escrow.lockFunds{value: AMOUNT}(taskId, agentB, COMMIT, resourceId);
    }

    // ---- SINGLE MODE ----

    function test_lockFunds_happy() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        AgentEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(t.funder, agentA);
        assertEq(t.agentB, agentB);
        assertEq(t.amount, AMOUNT);
        assertEq(uint8(t.status), uint8(AgentEscrow.TaskStatus.Funded));
    }

    function test_lockFunds_zeroValue_reverts() public {
        vm.prank(agentA);
        vm.expectRevert(AgentEscrow.ZeroValue.selector);
        escrow.lockFunds{value: 0}(keccak256("t1"), agentB, COMMIT);
    }

    function test_lockFunds_duplicateTaskId_reverts() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        vm.prank(agentA);
        vm.expectRevert(AgentEscrow.DuplicateTask.selector);
        escrow.lockFunds{value: AMOUNT}(taskId, agentB, COMMIT);
    }

    function test_relock_funded_reverts() public {
        // re-locking an already-funded task id (even by a different funder) reverts
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        vm.prank(agentA2);
        vm.expectRevert(AgentEscrow.DuplicateTask.selector);
        escrow.lockFunds{value: AMOUNT}(taskId, agentB, COMMIT);
    }

    function test_completeTask_hashMatch_releases() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        uint256 before = agentB.balance;
        vm.prank(agentB);
        escrow.completeTask(taskId, REPORT);
        assertEq(agentB.balance, before + AMOUNT);
        AgentEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint8(t.status), uint8(AgentEscrow.TaskStatus.Completed));
    }

    function test_completeTask_malformedReport_reverts() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        vm.prank(agentB);
        vm.expectRevert(AgentEscrow.MalformedReport.selector);
        escrow.completeTask(taskId, bytes32(0));
    }

    function test_completeTask_beforeFunded_reverts() public {
        // speculative gate: completing a task that was never funded reverts NotFunded
        vm.prank(agentB);
        vm.expectRevert(AgentEscrow.NotFunded.selector);
        escrow.completeTask(keccak256("ghost"), REPORT);
    }

    function test_completeTask_wrongCaller_reverts() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        vm.prank(agentA); // not agentB
        vm.expectRevert(AgentEscrow.WrongCaller.selector);
        escrow.completeTask(taskId, REPORT);
    }

    function test_completeTask_doubleClaim_reverts() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        vm.prank(agentB);
        escrow.completeTask(taskId, REPORT);
        vm.prank(agentB);
        vm.expectRevert(AgentEscrow.AlreadyResolved.selector);
        escrow.completeTask(taskId, REPORT);
    }

    function test_funder_reclaim_refund() public {
        bytes32 taskId = keccak256("t1");
        _lockSingle(taskId, agentA);
        uint256 before = agentA.balance;
        vm.prank(agentA);
        escrow.refund(taskId);
        assertEq(agentA.balance, before + AMOUNT);
        AgentEscrow.Task memory t = escrow.getTask(taskId);
        assertEq(uint8(t.status), uint8(AgentEscrow.TaskStatus.Refunded));
    }

    // ---- RACE MODE ----

    function test_race_firstFunder_claimsSlot() public {
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        assertEq(escrow.resourceWinner(resourceId), t1);
    }

    function test_race_laterFunderSameResource_refundable() public {
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        // loser can refund even though it's not the funder calling? It IS the funder.
        uint256 before = agentA2.balance;
        vm.prank(agentA2);
        escrow.refund(t2);
        assertEq(agentA2.balance, before + AMOUNT);
    }

    function test_race_winner_completeTask_succeeds() public {
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        uint256 before = agentB.balance;
        vm.prank(agentB);
        escrow.completeTask(t1, REPORT);
        assertEq(agentB.balance, before + AMOUNT);
    }

    function test_race_loser_completeTask_reverts() public {
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        vm.prank(agentB);
        vm.expectRevert(AgentEscrow.WrongCaller.selector);
        escrow.completeTask(t2, REPORT); // t2 lost the slot
    }

    function test_race_loser_refund_emitsReverted() public {
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        vm.expectEmit(true, false, false, true);
        emit AgentEscrow.TaskReverted(t2, "lost race");
        // anyone can trigger a losing-bid refund (funds always go to the funder)
        vm.prank(agentB);
        escrow.refund(t2);
    }

    function test_race_doubleRefund_reverts() public {
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        vm.prank(agentA2);
        escrow.refund(t2);
        vm.prank(agentA2);
        vm.expectRevert(AgentEscrow.NotRefundable.selector);
        escrow.refund(t2);
    }

    function test_race_threeWayCascade() public {
        // concert scenario: 3 fans, 1 ticket, 1 winner, 2 refunds
        bytes32 resourceId = keccak256("ticket-42");
        bytes32 t1 = keccak256("r1");
        bytes32 t2 = keccak256("r2");
        bytes32 t3 = keccak256("r3");
        _lockRace(t1, agentA, resourceId);
        _lockRace(t2, agentA2, resourceId);
        _lockRace(t3, agentA3, resourceId);

        assertEq(escrow.resourceWinner(resourceId), t1);

        vm.prank(agentB);
        escrow.completeTask(t1, REPORT);

        uint256 b2 = agentA2.balance;
        uint256 b3 = agentA3.balance;
        vm.prank(agentA2);
        escrow.refund(t2);
        vm.prank(agentA3);
        escrow.refund(t3);
        assertEq(agentA2.balance, b2 + AMOUNT);
        assertEq(agentA3.balance, b3 + AMOUNT);
    }
}
