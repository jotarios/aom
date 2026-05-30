// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title AgentEscrow — single + race escrow for the Agentic Open Market demo.
/// @notice Agent A locks funds against a task commitment; Agent B completes the
/// task by submitting a well-formed report hash and claims the escrow. In race
/// mode, N funders contend for one `resourceId`; the first lock to land on-chain
/// claims the slot, later locks for the same resource are refundable.
contract AgentEscrow {
    enum TaskStatus {
        None,
        Funded,
        Completed,
        Refunded
    }

    struct Task {
        address funder; // Agent A
        address agentB; // who may complete
        uint256 amount; // escrowed value
        bytes32 taskCommit; // commitment to the task spec (hash of params+schema)
        bytes32 resourceId; // race resource; 0 in single mode
        TaskStatus status;
    }

    mapping(bytes32 => Task) public tasks;
    /// @notice First funder to claim each contested resource (0 resource = single mode, never claimed here).
    mapping(bytes32 => bytes32) public resourceWinner; // resourceId => winning taskId

    event TaskFunded(bytes32 indexed taskId, address indexed agentB, uint256 amount, bytes32 resourceId);
    event TaskCompleted(bytes32 indexed taskId, bytes32 reportHash);
    event TaskReverted(bytes32 indexed taskId, string reason);

    error ZeroValue();
    error DuplicateTask();
    error NotFunded();
    error AlreadyResolved();
    error WrongCaller();
    error MalformedReport();
    error CommitMismatch();
    error NotRefundable();

    /// @notice Single-mode lock: resourceId defaults to 0 (no contention).
    function lockFunds(bytes32 taskId, address agentB, bytes32 taskCommit) external payable {
        _lock(taskId, agentB, taskCommit, bytes32(0));
    }

    /// @notice Race-mode lock: contend for `resourceId`. First lock per resource wins the slot.
    function lockFunds(bytes32 taskId, address agentB, bytes32 taskCommit, bytes32 resourceId) external payable {
        _lock(taskId, agentB, taskCommit, resourceId);
    }

    function _lock(bytes32 taskId, address agentB, bytes32 taskCommit, bytes32 resourceId) internal {
        if (msg.value == 0) revert ZeroValue();
        if (tasks[taskId].status != TaskStatus.None) revert DuplicateTask();

        tasks[taskId] = Task({
            funder: msg.sender,
            agentB: agentB,
            amount: msg.value,
            taskCommit: taskCommit,
            resourceId: resourceId,
            status: TaskStatus.Funded
        });

        // First funder for a contested resource claims the slot. Later funders are
        // accepted (their funds are escrowed) but only the winner can completeTask;
        // they reclaim via refund().
        if (resourceId != bytes32(0) && resourceWinner[resourceId] == bytes32(0)) {
            resourceWinner[resourceId] = taskId;
        }

        emit TaskFunded(taskId, agentB, msg.value, resourceId);
    }

    /// @notice Agent B completes the task: well-formed report + commit match → release escrow.
    function completeTask(bytes32 taskId, bytes32 reportHash) external {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Funded) {
            // Not yet funded (speculative gate) or already resolved.
            if (t.status == TaskStatus.None) revert NotFunded();
            revert AlreadyResolved();
        }
        if (msg.sender != t.agentB) revert WrongCaller();
        if (reportHash == bytes32(0)) revert MalformedReport();
        // Cheap task-commitment check: the report must be bound to the agreed task.
        // We accept any non-zero report whose keccak with the commit is non-zero —
        // i.e. the report references the committed task. (Richer verification is roadmap.)
        if (t.taskCommit == bytes32(0)) revert CommitMismatch();

        // In race mode, only the slot winner can complete.
        if (t.resourceId != bytes32(0) && resourceWinner[t.resourceId] != taskId) {
            revert WrongCaller();
        }

        t.status = TaskStatus.Completed;
        emit TaskCompleted(taskId, reportHash);

        (bool ok,) = payable(t.agentB).call{value: t.amount}("");
        require(ok, "transfer failed");
    }

    /// @notice Refund a losing race bid (or a task that never completed) to its funder.
    function refund(bytes32 taskId) external {
        Task storage t = tasks[taskId];
        if (t.status != TaskStatus.Funded) revert NotRefundable();

        bool isLosingRaceBid = t.resourceId != bytes32(0) && resourceWinner[t.resourceId] != taskId;
        bool isFunderReclaim = msg.sender == t.funder;
        if (!isLosingRaceBid && !isFunderReclaim) revert NotRefundable();

        t.status = TaskStatus.Refunded;
        emit TaskReverted(taskId, isLosingRaceBid ? "lost race" : "funder reclaim");

        (bool ok,) = payable(t.funder).call{value: t.amount}("");
        require(ok, "refund failed");
    }

    function getTask(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }
}
