from __future__ import annotations

from datetime import date, timedelta

from .models import CreditReportItem


def dispute_letter(item: CreditReportItem, consumer_name: str, consumer_address: str) -> str:
    today = date.today().strftime("%B %d, %Y")
    deadline = (date.today() + timedelta(days=30)).strftime("%B %d, %Y")
    return f"""{today}

{item.bureau} — Credit Bureau Dispute Department

Re: Formal Dispute Under FCRA § 611 — Account {item.account_number_masked}

Consumer: {consumer_name}
Address:  {consumer_address}

To Whom It May Concern,

I am writing to dispute information appearing on my consumer credit file pursuant to my rights
under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i.

Disputed Item:
  Furnisher:       {item.furnisher}
  Account number:  {item.account_number_masked}
  Issue type:      {item.issue_type}
  Details:         {item.details}
  Date identified: {item.date_identified.isoformat()}

Requested Actions:
  1. Reinvestigate this item and delete it if it cannot be verified within 30 days
     (FCRA § 611(a)(5)(A)).
  2. Correct any inaccurate information and provide me a free updated copy of my report
     (FCRA § 612(a)).
  3. Provide the name, address, and telephone number of any furnisher contacted during
     reinvestigation (FCRA § 611(a)(6)(B)(iii)).
  4. Block re-insertion of any deleted information unless the furnisher certifies accuracy
     and notifies me in advance (FCRA § 611(a)(5)(B)).

Please complete your investigation and send written results no later than {deadline} — the
30-day statutory window under FCRA § 611(a)(1). Send correspondence to the mailing address above.
I recommend both parties retain certified mail receipts as documentation.

If this item is not corrected or deleted, I reserve the right to:
  - Add a 100-word consumer statement to my file (FCRA § 611(b)).
  - File a complaint with the Consumer Financial Protection Bureau (CFPB) at
    consumerfinance.gov/complaint.
  - Seek actual, statutory, and punitive damages as provided under FCRA §§ 616–617.

Sincerely,
{consumer_name}

Enclosures: [Attach copies of supporting documentation — do NOT send originals]
"""


def escalation_letter(
    item: CreditReportItem,
    consumer_name: str,
    consumer_address: str,
    prior_dispute_date: date,
) -> str:
    today = date.today().strftime("%B %d, %Y")
    return f"""{today}

Consumer Financial Protection Bureau (CFPB)
PO Box 4503, Iowa City, IA 52244
consumerfinance.gov/complaint

Re: FCRA Complaint — Unresolved Dispute with {item.bureau} / {item.furnisher}
    Account: {item.account_number_masked}

Consumer: {consumer_name}
Address:  {consumer_address}

To the CFPB,

I previously submitted a formal dispute to {item.bureau} on {prior_dispute_date.strftime("%B %d, %Y")}
regarding inaccurate information furnished by {item.furnisher}
(account {item.account_number_masked}).

Issue: {item.issue_type}
Details: {item.details}

The bureau has failed to:
  (a) Conduct a proper reinvestigation within 30 days as required by FCRA § 611(a)(1).
  (b) Delete the unverifiable information per FCRA § 611(a)(5)(A).
  (c) Provide written notification of results within the statutory window.

I am filing this CFPB complaint and requesting investigation of both {item.bureau} and
{item.furnisher} for FCRA violations. Documentation of my original dispute is available
upon request.

Sincerely,
{consumer_name}
"""


def remediation_steps() -> list[str]:
    return [
        "Pull free reports from all three bureaus at AnnualCreditReport.com (free weekly through 2026).",
        "Flag data mismatches: late pays reported after closure, wrong balances, duplicate collections.",
        "Send bureau-specific disputes via certified mail with copies of supporting evidence attached.",
        "Track 30-day investigation windows — follow up on day 25 if no response received.",
        "If unresolved after 30 days, escalate to CFPB at consumerfinance.gov/complaint.",
        "Add a 100-word consumer statement to disputed items while investigation is pending (FCRA § 611(b)).",
        "Consult an FCRA attorney if violations persist — many work on contingency at no upfront cost.",
    ]
