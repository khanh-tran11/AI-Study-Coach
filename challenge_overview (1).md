# Challenge Overview: AI Trainer — Conversational onboarding agent for new distance education faculty

## Project Objectives
- Deliver a guided, concierge-style onboarding experience that walks new distance education faculty through Canvas training conversationally.
- Enable a linear, sequenced training flow where users complete modules (e.g., setting up a Canvas shell, exporting grades) with interactive prompts to try tasks themselves.
- Improve the new-faculty experience by replacing a static stack of links and documents with a hand-held, breadcrumbed walkthrough.
- Reduce onboarding time and one-on-one support load; track measurable on-time module completion.
- Leave room to grow into a broader policy-based chat retrieval surface and an avatar/live video agent.

## Current Workflow
- Training content lives in Word documents and instructor-created videos, plus website and Instructure (Canvas maker) resources.
- New faculty receive a stack of policies, procedures, and links and must complete trainings within roughly a week.
- Users self-navigate scattered, static materials; when stuck, they call internal staff.
- How-to guides and onboarding videos are maintained separately as standalone artifacts.
- An existing live chat / chatbot and help desk channels exist for support, with escalation to the LMS administrator and Instructure 24/7 support.

## Key Pain Points
- Training materials are static and fragmented across documents, videos, and sites, making navigation hard.
- Completing tasks requires hand-holding; stuck users default to phone calls because there's no in-flow guidance.
- Time cost of assembling and sequencing scattered onboarding content for each new hire.
- High volume of basic "I'm stuck on a step" requests that could be self-served by a guided agent.
- No system tracks progression — staff only find out users are stuck when they call.

## Ideal Solution Vision
- A conversational training agent (chat, optionally with an avatar/video representation) guiding faculty through a sequenced onboarding flow.
- Example: user says "I'm creating a module and the field won't submit" → agent provides in-context help, then offers escalation to live chat, LMS admin email, Instructure support, or scheduling a training. *(Addresses the "stuck on a step" pain point.)*
- Index existing how-to docs, videos, and website content as the knowledge source, with citations/links back to source material. *(Reuses existing artifacts per Data Availability.)*
- A progress dashboard showing "Module 7 of 10," with enforced stage-gating between sequential modules. *(Addresses the no-progress-tracking pain point.)*
- After completion, graduate users into broad policy-based chat retrieval across all learned topics, then access to their Canvas shell.

## Data Availability
- Primary sources: existing how-to documentation (Word), instructor-created onboarding videos (raw MP4 available), and college website content.
- Supplementary: Instructure/Canvas maker reference material; existing live chat/chatbot content.
- Human resources: SMEs and LMS administrator available to provide documentation, content, and guidance.
- Permission granted to transcribe and extract data from videos as needed; no proprietary lock-in.

---

**Assumptions made:**
- The submission form describes a Colleague SIS timecard training use case, but the discovery call reframes the challenge as **Canvas distance-education faculty onboarding**. This template follows the discovery call as the more recent, detailed scope; confirm whether timecard training is in or out of scope.
- The avatar/live video agent is treated as a stretch direction ("if achievable") rather than a core requirement, per the call.
- Escalation routing (help desk, LMS admin, Instructure, calendar scheduling) is assumed to be an integration point, not built from scratch — exact integration depth is undefined and should be confirmed.