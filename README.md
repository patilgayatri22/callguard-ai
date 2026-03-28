# callguard-ai
AI meeting agent for customer support or success calls. The agent listens to live conversation, scores churn risk, refund likelihood, and escalation need, then creates tickets, updates CRM notes, and notifies the right stakeholders using the signed-in user’s permissions. 


## Problem statement
Customer teams often notice risk signals too late: cancellation intent, repeated complaints, refund requests, or unresolved escalation cues. Even when a rep hears the signal, the follow-through is inconsistent: CRM notes are not updated, tickets are delayed, managers are not alerted, and promised next steps get lost.
This project solves that gap by turning live call understanding into immediate, permission-aware actions. Instead of a passive note taker, the agent behaves like an operational co-pilot that can act safely on behalf of a user.


## Idea for this hackathon
It directly matches both products in the hackathon stack. MeetStream provides the meeting agent and transcript infrastructure, while Scalekit handles identity and authorization.
It is also visually demo-friendly: the judges can see risk scores change in real time, then watch tickets, alerts, and CRM updates happen immediately.
For an AI/ML-heavy builder, the idea is strong because it showcases classification, scoring, explainability, thresholding, and action orchestration rather than only prompt-based summarization.


## Core user scenario
Primary demo scenario: a customer support retention call.
•	A customer joins a support call already frustrated about an unresolved billing or service issue.
•	During the conversation, the customer mentions repeat failures, asks for a refund, and threatens to cancel if the issue is not resolved immediately.
•	The agent detects negative sentiment, cancellation intent, and escalation need.
•	The system creates a high-priority support ticket, updates the CRM with a churn-risk note, and sends a manager alert in Slack.
•	If the rep lacks permission to trigger a refund, the UI clearly shows that the refund workflow was blocked by policy.


## AI/ML system design

Recommended approach: hybrid scoring + LLM reasoning
Use the LLM for structured extraction, intent detection, evidence gathering, and suggested next action. Layer simple scoring logic or heuristic calibration on top so the system feels more like a data product and less like a pure prompt demo.

The LLM should classify customer state and business risk from the latest rolling window of conversation. The backend can then combine these outputs with deterministic thresholds to decide which actions are safe to trigger.

