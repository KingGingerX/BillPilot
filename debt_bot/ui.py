from __future__ import annotations

import os
import re
from datetime import date

import streamlit as st

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from .credit_repair import dispute_letter, escalation_letter, remediation_steps
from .investor_research import InvestorQuery, format_investor_report, research_investor
from .models import CreditReportItem, DebtAccount
from .negotiation import (
    build_closing_script,
    build_counter_offer_script,
    build_opening_script,
    call_checklist,
    payoff_comparison,
    propose_offer,
)
from .storage import SecureTaskStore
from .tier import (
    FREE_MONTHLY_LIMIT,
    PRO_FEATURES,
    PRO_PRICE_USD,
    STRIPE_UPGRADE_LINK,
    Tier,
    check_usage,
    get_tier,
)

_store: SecureTaskStore | None = None


def _get_store() -> SecureTaskStore:
    global _store
    if _store is None:
        _store = SecureTaskStore()
    return _store


def _render_email_capture(source: str) -> None:
    """Email lead capture form shown when a user hits the free limit."""
    with st.form(f"email_capture_{source}", clear_on_submit=True):
        st.markdown("**Get early access to Pro + exclusive debt tips:**")
        email_input = st.text_input("Your email", placeholder="you@example.com")
        submitted = st.form_submit_button("Notify Me", use_container_width=True)
        if submitted:
            if email_input and re.match(r"[^@]+@[^@]+\.[^@]+", email_input):
                _get_store().capture_email_lead(email=email_input, source=source)
                st.success("You're on the list — we'll reach out soon!")
            else:
                st.warning("Please enter a valid email address.")


def _render_upgrade_cta(context: str = "") -> None:
    """Inline Pro upgrade call-to-action with feature list."""
    st.warning(
        f"You've used all {FREE_MONTHLY_LIMIT} free uses this month. "
        f"Upgrade to Pro (${PRO_PRICE_USD:.0f}/mo) for unlimited access."
    )
    with st.expander("What's included in Pro"):
        for feat in PRO_FEATURES:
            st.markdown(f"- {feat}")
    st.markdown(f"[**Upgrade to Pro — ${PRO_PRICE_USD:.0f}/mo →**]({STRIPE_UPGRADE_LINK})")
    _render_email_capture(source=context or "upgrade_cta")


def _render_sidebar() -> None:
    with st.sidebar:
        st.markdown("## BillPilot")
        tier = get_tier()
        if tier == Tier.PRO:
            st.success("Pro plan — unlimited")
        else:
            _, neg_remaining = check_usage("negotiate", _get_store())
            _, dis_remaining = check_usage("dispute", _get_store())
            st.info(
                f"**Free plan**\n"
                f"- Negotiations: {neg_remaining}/{FREE_MONTHLY_LIMIT} left this month\n"
                f"- Disputes: {dis_remaining}/{FREE_MONTHLY_LIMIT} left this month"
            )
            st.markdown(f"[**Upgrade to Pro — ${PRO_PRICE_USD:.0f}/mo →**]({STRIPE_UPGRADE_LINK})")
            with st.expander("Pro includes"):
                for feat in PRO_FEATURES:
                    st.markdown(f"- {feat}")

        st.divider()
        st.markdown("### Free Resources")
        st.markdown(
            "- [Free Credit Reports](https://www.annualcreditreport.com"
            "?utm_source=billpilot&utm_medium=app)\n"
            "- [Check Your Free Credit Score](https://www.creditkarma.com"
            "?utm_source=billpilot&utm_medium=app)\n"
            "- [CFPB Complaint Portal](https://www.consumerfinance.gov/complaint/)\n"
            "- [Debt Collection FAQ (CFPB)](https://www.consumerfinance.gov"
            "/consumer-tools/debt-collection/)\n"
            "- [Non-Profit Credit Counseling](https://www.nfcc.org"
            "?utm_source=billpilot&utm_medium=app)\n"
            "- [Find an FCRA Attorney (NACA)](https://www.consumeradvocates.org"
            "/find-an-attorney?utm_source=billpilot&utm_medium=app)\n"
            "- [Bankruptcy Court Locator](https://www.uscourts.gov/court-locator)"
        )
        st.divider()
        st.caption(
            "BillPilot is for educational and workflow-support purposes only. "
            "It is not legal advice. Review your state's laws before contacting creditors."
        )


def _render_negotiation_tab() -> None:
    st.subheader("Creditor Negotiation Planner")
    st.caption("Enter your real numbers to generate a personalized call script and offer strategy.")

    col_left, col_right = st.columns(2)
    with col_left:
        creditor_name = st.text_input("Creditor", value="Sample Bank")
        account_reference = st.text_input("Account reference", value="****1234")
        current_balance = st.number_input("Current balance ($)", min_value=0.0, value=8400.0, step=100.0)
        current_monthly_payment = st.number_input(
            "Current monthly payment ($)", min_value=0.0, value=320.0, step=10.0
        )

    with col_right:
        apr_percent = st.number_input("APR (%)", min_value=0.0, value=24.99, step=0.25)
        hardship_reason = st.text_input("Hardship reason", value="temporary income reduction")
        target_monthly_payment = st.number_input(
            "Target monthly payment ($)", min_value=0.0, value=180.0, step=10.0
        )
        max_settlement_amount = st.number_input(
            "Max settlement amount ($)",
            min_value=0.0,
            value=4200.0,
            step=50.0,
            help="Most you can pay as a lump sum to settle the full balance (enter 0 if not applicable)",
        )

    if st.button("Generate negotiation plan", use_container_width=True, type="primary"):
        allowed, remaining = check_usage("negotiate", _get_store())
        if not allowed:
            _render_upgrade_cta("negotiate")
            return

        try:
            account = DebtAccount(
                creditor_name=creditor_name,
                account_reference=account_reference,
                current_balance=current_balance,
                current_monthly_payment=current_monthly_payment,
                apr_percent=apr_percent,
                hardship_reason=hardship_reason,
                target_monthly_payment=target_monthly_payment,
                max_settlement_amount=max_settlement_amount,
            )
        except Exception as e:
            st.error(f"Input validation error: {e}")
            return

        store = _get_store()
        store.log_request(
            task_type="negotiate_ui",
            details={"creditor_name": creditor_name, "account_reference": account_reference},
        )

        offer = propose_offer(account)
        opening = build_opening_script(account)
        counter = build_counter_offer_script(account, offer)

        st.markdown("---")
        st.markdown("### Your Plan at a Glance")

        m1, m2, m3, m4, m5 = st.columns(5)
        monthly_savings = account.current_monthly_payment - offer.requested_payment
        m1.metric(
            "Monthly savings",
            f"${monthly_savings:,.0f}/mo",
            delta=f"-${monthly_savings:,.0f}",
            delta_color="inverse",
        )
        if offer.settlement_amount is not None:
            m2.metric("Settlement target", f"${offer.settlement_amount:,.0f}")
        else:
            m2.metric("Settlement target", "N/A", help="Enter a max settlement amount to enable this")
        if offer.months_to_payoff:
            m3.metric("Months to pay off", str(offer.months_to_payoff))
        else:
            m3.metric("Months to pay off", "∞", help="Payment doesn't cover interest at this rate")
        if offer.total_interest_at_current_plan is not None and offer.total_interest_at_new_plan is not None:
            diff = offer.total_interest_at_current_plan - offer.total_interest_at_new_plan
            if diff >= 0:
                m4.metric(
                    "Interest saved",
                    f"${diff:,.0f}",
                    delta=f"-${diff:,.0f}",
                    delta_color="inverse",
                )
            else:
                m4.metric(
                    "Extra interest cost",
                    f"${-diff:,.0f}",
                    delta=f"+${-diff:,.0f}",
                    help="Lower payment = longer timeline = more total interest paid",
                )
        score = offer.hardship_score
        score_label = "Strong" if score >= 80 else "Moderate" if score >= 60 else "Fair"
        m5.metric("Hardship score", f"{score}/100", help=f"{score_label} negotiating position")

        with st.expander("Call opening script", expanded=True):
            st.code(opening, language=None)
            st.download_button(
                "Download opening script (.txt)",
                data=opening,
                file_name="opening_script.txt",
                mime="text/plain",
            )

        with st.expander("If they say no — counter-offer script"):
            st.code(counter, language=None)
            st.download_button(
                "Download counter-offer (.txt)",
                data=counter,
                file_name="counter_offer_script.txt",
                mime="text/plain",
            )

        with st.expander("Offer details (share if asked)"):
            offer_data: dict = {
                "creditor_name": offer.creditor_name,
                "requested_monthly_payment": offer.requested_payment,
                "settlement_lump_sum": offer.settlement_amount,
                "hardship_score": offer.hardship_score,
                "require_no_term_extension": offer.require_no_term_extension,
                "ask_fee_waiver": offer.ask_fee_waiver,
                "ask_apr_reduction": offer.ask_apr_reduction,
            }
            if offer.months_to_payoff:
                offer_data["months_to_payoff"] = offer.months_to_payoff
            if offer.total_interest_at_current_plan is not None:
                offer_data["interest_at_current_plan"] = offer.total_interest_at_current_plan
            if offer.total_interest_at_new_plan is not None:
                offer_data["interest_at_new_plan"] = offer.total_interest_at_new_plan
            st.json(offer_data)

        with st.expander("Call checklist"):
            for i, step in enumerate(call_checklist()):
                st.checkbox(step, value=False, key=f"neg_chk_{i}")

        with st.expander("Closing script"):
            closing = build_closing_script()
            st.code(closing, language=None)

        store.log_task_completed(
            task_type="negotiate_ui",
            details={"requested_payment": offer.requested_payment, "settlement_amount": offer.settlement_amount},
        )
        remaining_after = remaining - 1
        if get_tier() == Tier.FREE and remaining_after == 0:
            st.info(f"That was your last free negotiation plan this month.")
            _render_upgrade_cta("negotiate_last")
        else:
            st.success("Plan generated and saved to history.")


def _render_credit_dispute_tab() -> None:
    st.subheader("Credit Report Dispute Generator")
    st.caption("Generate an FCRA-compliant dispute letter ready to mail to any bureau.")

    col_left, col_right = st.columns(2)
    with col_left:
        bureau = st.selectbox("Bureau", ["Experian", "Equifax", "TransUnion"])
        furnisher = st.text_input("Furnisher / creditor name", value="ABC Collections")
        account_number = st.text_input("Account number (masked)", value="****9999")
        issue_type = st.text_input("Issue type", value="Duplicate collection")

    with col_right:
        details = st.text_area(
            "Issue details",
            value="Same debt appears twice with different open dates.",
            height=110,
        )
        consumer_name = st.text_input("Your full name", value="Jane Doe")
        consumer_address = st.text_area("Your mailing address", value="123 Main St, City, ST 00000", height=80)

    prior_dispute_date_str = st.text_input(
        "Prior dispute date (YYYY-MM-DD) — leave blank for first dispute",
        value="",
        help="Only fill this in if the bureau already failed to respond to an earlier dispute",
    )

    if st.button("Generate dispute letter", use_container_width=True, type="primary"):
        allowed, remaining = check_usage("dispute", _get_store())
        if not allowed:
            _render_upgrade_cta("dispute")
            return

        item = CreditReportItem(
            bureau=bureau,
            furnisher=furnisher,
            account_number_masked=account_number,
            issue_type=issue_type,
            details=details,
            date_identified=date.today(),
        )

        store = _get_store()
        pii_record_id = store.store_pii(
            task_type="dispute_ui",
            pii_data={"consumer_name": consumer_name, "consumer_address": consumer_address},
        )
        store.log_request(
            task_type="dispute_ui",
            details={
                "bureau": bureau,
                "furnisher": furnisher,
                "account_number_masked": account_number,
                "pii_record_id": pii_record_id,
            },
        )

        letter = dispute_letter(item, consumer_name, consumer_address)

        st.markdown("---")
        st.markdown("### Dispute Letter")
        st.code(letter, language=None)

        safe_account = account_number.replace("*", "x")
        col_dl, col_ai = st.columns([2, 1])
        with col_dl:
            st.download_button(
                "Download letter (.txt)",
                data=letter,
                file_name=f"dispute_{bureau.lower()}_{safe_account}.txt",
                mime="text/plain",
            )
        with col_ai:
            if get_tier() == Tier.PRO:
                if st.button("Enhance with AI (Pro)", help="Uses Claude to add FCRA citations and strengthen language"):
                    if not os.getenv("ANTHROPIC_API_KEY"):
                        st.warning("Set ANTHROPIC_API_KEY in your .env file to use AI enhancement.")
                    else:
                        with st.spinner("Enhancing with Claude..."):
                            try:
                                from .ai_enhance import enhance_dispute_letter
                                enhanced = enhance_dispute_letter(letter)
                                st.markdown("### AI-Enhanced Letter")
                                st.code(enhanced, language=None)
                                st.download_button(
                                    "Download enhanced letter (.txt)",
                                    data=enhanced,
                                    file_name=f"dispute_{bureau.lower()}_{safe_account}_enhanced.txt",
                                    mime="text/plain",
                                )
                            except Exception as e:
                                st.error(f"AI enhancement failed: {e}")
            else:
                st.button(
                    "Enhance with AI (Pro only)",
                    disabled=True,
                    help=f"Upgrade to Pro (${PRO_PRICE_USD:.0f}/mo) to unlock AI-powered FCRA citations.",
                )

        # Escalation letter section (only shown when prior dispute date is provided)
        if prior_dispute_date_str.strip():
            try:
                prior_date = date.fromisoformat(prior_dispute_date_str.strip())
                esc_letter = escalation_letter(
                    item=item,
                    consumer_name=consumer_name,
                    consumer_address=consumer_address,
                    prior_dispute_date=prior_date,
                )
                with st.expander("CFPB Escalation Letter (bureau didn't respond in 30 days)"):
                    st.code(esc_letter, language=None)
                    st.download_button(
                        "Download escalation letter (.txt)",
                        data=esc_letter,
                        file_name=f"cfpb_escalation_{bureau.lower()}_{safe_account}.txt",
                        mime="text/plain",
                    )
            except ValueError:
                st.warning("Prior dispute date must be in YYYY-MM-DD format (e.g., 2026-03-15).")

        st.markdown("### Remediation Checklist")
        for i, step in enumerate(remediation_steps()):
            st.checkbox(step, value=False, key=f"rem_chk_{i}")

        store.log_task_completed(
            task_type="dispute_ui",
            details={"bureau": bureau, "issue_type": issue_type, "pii_record_id": pii_record_id},
        )
        remaining_after = remaining - 1
        if get_tier() == Tier.FREE and remaining_after == 0:
            st.info("That was your last free dispute letter this month.")
            _render_upgrade_cta("dispute_last")
        else:
            st.success("Your name/address encrypted (AES-Fernet) and stored. History saved.")


def _render_history_panel() -> None:
    st.subheader("Activity History")
    store = _get_store()
    rows = store.get_recent_history(limit=50)
    if not rows:
        st.info("No activity yet. Use the Negotiation or Credit Dispute tabs to get started.")
        return

    st.caption(f"Showing last {len(rows)} events")
    st.dataframe(rows, use_container_width=True)

    if st.button("Clear history", type="secondary"):
        if store.history_path.exists():
            store.history_path.unlink()
        st.rerun()


def _render_payoff_calculator_tab() -> None:
    st.subheader("Debt Payoff Accelerator")
    st.caption(
        "See how adding even a small extra payment each month slashes your interest and payoff time."
    )

    col_left, col_right = st.columns(2)
    with col_left:
        pc_balance = st.number_input(
            "Current balance ($)", min_value=0.01, value=8400.0, step=100.0, key="pc_bal"
        )
        pc_apr = st.number_input(
            "APR (%)", min_value=0.0, value=24.99, step=0.25, key="pc_apr"
        )
    with col_right:
        pc_payment = st.number_input(
            "Minimum monthly payment ($)", min_value=0.01, value=320.0, step=10.0, key="pc_pay"
        )
        pc_extra = st.slider(
            "Extra monthly payment ($)", min_value=0, max_value=1000, value=100, step=25, key="pc_extra"
        )

    result = payoff_comparison(
        balance=pc_balance,
        apr_percent=pc_apr,
        monthly_payment=pc_payment,
        extra_payment=float(pc_extra),
    )

    st.markdown("---")
    m1, m2, m3, m4 = st.columns(4)

    base_mo = result["base_months"]
    fast_mo = result["fast_months"]
    mo_saved = result["months_saved"]
    int_saved = result["interest_saved"]

    m1.metric(
        "Payoff (current)",
        f"{base_mo} mo" if base_mo else "Never",
        help="Months to pay off at your current payment",
    )
    m2.metric(
        f"Payoff (+${pc_extra}/mo)",
        f"{fast_mo} mo" if fast_mo else "Never",
        delta=f"-{mo_saved} mo" if mo_saved and mo_saved > 0 else None,
        delta_color="inverse",
    )
    m3.metric(
        "Interest (current)",
        f"${result['base_interest']:,.0f}" if result["base_interest"] is not None else "N/A",
    )
    m4.metric(
        "Interest saved",
        f"${int_saved:,.0f}" if int_saved is not None and int_saved > 0 else "$0",
        delta=f"-${int_saved:,.0f}" if int_saved and int_saved > 0 else None,
        delta_color="inverse",
    )

    if mo_saved and mo_saved > 0 and int_saved and int_saved > 0:
        st.success(
            f"Adding ${pc_extra}/mo frees you from debt **{mo_saved} months sooner** "
            f"and saves **${int_saved:,.0f} in interest**."
        )
    elif pc_extra == 0:
        st.info("Move the slider to see how extra payments accelerate your payoff.")
    else:
        st.info("Your extra payment doesn't meaningfully accelerate payoff at these numbers.")

    st.divider()
    st.markdown("### Ready to negotiate a lower payment?")
    st.markdown(
        "Use the **Negotiation** tab to generate a personalized call script that gets creditors "
        "to lower your APR and monthly payment — then put those savings toward extra payments here."
    )
    if get_tier() == Tier.FREE:
        st.markdown(
            f"[**Upgrade to Pro (${PRO_PRICE_USD:.0f}/mo) for unlimited plans →**]({STRIPE_UPGRADE_LINK})"
        )


def _render_investor_research_tab() -> None:
    st.subheader("Angel Investor Research Tool")
    st.caption(
        "Research any angel investor and generate a tailored pitch strategy powered by AI. "
        "Requires ANTHROPIC_API_KEY."
    )

    if not os.getenv("ANTHROPIC_API_KEY"):
        st.warning(
            "ANTHROPIC_API_KEY is not set. Add it to your `.env` file to use this tool.\n\n"
            "```\nANTHROPIC_API_KEY=sk-ant-...\n```"
        )

    st.markdown("### Step 1 — Who are you researching?")
    col_l, col_r = st.columns(2)
    with col_l:
        investor_name = st.text_input(
            "Investor name *",
            placeholder="e.g. Naval Ravikant",
        )
        firm = st.text_input(
            "Firm / affiliation (optional)",
            placeholder="e.g. AngelList, a16z",
        )
        investor_notes = st.text_area(
            "Notes you've already gathered (optional)",
            placeholder=(
                "Paste anything you know: LinkedIn bio, blog posts, tweets, "
                "portfolio list, interviews…"
            ),
            height=120,
        )

    with col_r:
        venture_name = st.text_input(
            "Your venture name *",
            placeholder="e.g. CleanSlate Health",
        )
        venture_description = st.text_area(
            "What you're building *",
            placeholder=(
                "2–3 sentences: what it is, who it serves, and how it works."
            ),
            height=90,
        )
        sector = st.text_input(
            "Sector / industry *",
            placeholder="e.g. HealthTech, CleanEnergy, EdTech",
        )
        stage = st.selectbox(
            "Your current stage *",
            ["Pre-Idea / Concept", "Pre-Seed", "Seed", "Series A", "Series B+"],
        )
        good_cause = st.text_area(
            "Mission / why it matters *",
            placeholder=(
                "Why is this a good cause? What problem does it solve? "
                "What impact does it create?"
            ),
            height=90,
        )

    st.divider()

    if st.button(
        "Research Investor & Build Pitch Strategy",
        use_container_width=True,
        type="primary",
        disabled=not os.getenv("ANTHROPIC_API_KEY"),
    ):
        # Validate required fields
        missing = []
        if not investor_name.strip():
            missing.append("Investor name")
        if not venture_name.strip():
            missing.append("Your venture name")
        if not venture_description.strip():
            missing.append("What you're building")
        if not sector.strip():
            missing.append("Sector")
        if not good_cause.strip():
            missing.append("Mission / why it matters")
        if missing:
            st.error(f"Please fill in: {', '.join(missing)}")
            return

        try:
            query = InvestorQuery(
                investor_name=investor_name,
                firm_or_affiliation=firm,
                your_venture_name=venture_name,
                your_venture_description=venture_description,
                your_sector=sector,
                your_stage=stage,
                why_good_cause=good_cause,
                additional_investor_notes=investor_notes,
            )
        except Exception as e:
            st.error(f"Input validation error: {e}")
            return

        store = _get_store()
        store.log_request(
            task_type="investor_research",
            details={"investor_name": investor_name, "venture_name": venture_name},
        )

        with st.spinner(f"Researching {investor_name} and crafting your pitch strategy…"):
            try:
                data = research_investor(query)
            except Exception as e:
                st.error(f"Research failed: {e}")
                return

        st.markdown("---")

        # ── Investor Overview ──────────────────────────────────────────────
        conf = data.get("data_confidence", {})
        conf_level = (conf.get("level") or "unknown").lower()
        conf_color = {"high": "🟢", "medium": "🟡", "low": "🔴"}.get(conf_level, "⚪")

        st.markdown(f"## {data.get('name', investor_name)}")
        st.caption(
            f"{data.get('firm_or_affiliation', '')}  ·  "
            f"{data.get('location', '')}  ·  "
            f"Data confidence: {conf_color} {conf_level.capitalize()}"
        )
        if conf.get("note"):
            st.info(f"**Confidence note:** {conf['note']}")

        # Metrics row
        score = data.get("venture_alignment_score")
        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Stage Focus", data.get("investment_stage", "—"))
        m2.metric("Typical Check", data.get("typical_check_size", "—"))
        m3.metric("Geography", data.get("geographic_preference", "—"))
        if score is not None:
            bar = "█" * int(score) + "░" * (10 - int(score))
            m4.metric("Venture Fit", f"{score}/10", help=bar)

        # Investor profile expander
        with st.expander("Investor Profile — Biography & Background", expanded=True):
            st.markdown("**Biography**")
            st.write(data.get("bio_summary", "Not available"))
            st.markdown("**Professional Background**")
            st.write(data.get("professional_background", "Not available"))

            col_a, col_b = st.columns(2)
            with col_a:
                st.markdown("**Investment Focus Areas**")
                for item in (data.get("investment_focus") or []):
                    st.markdown(f"- {item}")
            with col_b:
                st.markdown("**Notable Investments**")
                for item in (data.get("notable_investments") or []):
                    st.markdown(f"- {item}")

            if data.get("recent_themes"):
                st.markdown("**Recent Themes & Priorities**")
                st.write(data["recent_themes"])

            quotes = data.get("quotes") or []
            if quotes:
                st.markdown("**Notable Quotes**")
                for q in quotes:
                    st.markdown(f"> _{q}_")

        # What they look for expander
        with st.expander("What They Look For — Criteria & Red Flags"):
            col_a, col_b = st.columns(2)
            with col_a:
                st.markdown("**What they look for in companies**")
                for item in (data.get("what_they_look_for") or []):
                    st.markdown(f"- {item}")
                st.markdown("**Founder preferences**")
                for item in (data.get("founder_preferences") or []):
                    st.markdown(f"- {item}")
            with col_b:
                st.markdown("**Red flags (what causes them to pass)**")
                for item in (data.get("red_flags") or []):
                    st.markdown(f"- {item}")

        # Contact expander
        with st.expander("Contact Intelligence"):
            cc = data.get("contact_channels") or {}
            col_a, col_b = st.columns(2)
            with col_a:
                st.markdown(f"**LinkedIn:** {cc.get('linkedin', 'Not available')}")
                st.markdown(f"**Twitter/X:** {cc.get('twitter', 'Not available')}")
                st.markdown(f"**Website:** {cc.get('website', 'Not available')}")
                st.markdown(f"**Email:** {cc.get('email', 'Not publicly listed')}")
            with col_b:
                st.markdown("**Best Approach**")
                st.write(cc.get("best_approach", "Not available"))

        # ── Venture Fit ────────────────────────────────────────────────────
        st.markdown("---")
        st.markdown("### Venture Fit Analysis")
        if score is not None:
            pct = int(score) * 10
            st.progress(pct, text=f"Alignment score: **{score}/10**")
        st.write(data.get("venture_alignment_rationale", "Not available"))

        # ── Pitch Strategy ─────────────────────────────────────────────────
        st.markdown("---")
        st.markdown("### Pitch Strategy")

        ps = data.get("pitch_strategy") or {}

        st.markdown("#### Opening Hook")
        st.info(ps.get("headline_hook", "Not available"))

        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown("**Key Alignment Points**")
            for item in (ps.get("key_alignment_points") or []):
                st.markdown(f"- {item}")
            st.markdown("**Metrics to Lead With**")
            for item in (ps.get("metrics_to_lead_with") or []):
                st.markdown(f"- {item}")
        with col_b:
            st.markdown("**Core Talking Points**")
            for item in (ps.get("core_talking_points") or []):
                st.markdown(f"- {item}")
            st.markdown("**Things to Avoid**")
            for item in (ps.get("things_to_avoid") or []):
                st.markdown(f"- {item}")

        st.markdown("**Questions to Ask Them**")
        for item in (ps.get("questions_to_ask_them") or []):
            st.markdown(f"- {item}")

        st.markdown("**Follow-Up Strategy**")
        st.write(ps.get("follow_up_strategy", "Not available"))

        # ── Outreach Email ─────────────────────────────────────────────────
        st.markdown("---")
        st.markdown("### Cold Outreach Email Template")
        em = data.get("outreach_email") or {}
        st.markdown(f"**Subject:** `{em.get('subject_line', '')}`")
        st.code(em.get("body", "Not available"), language=None)
        safe_name = re.sub(r"[^a-z0-9_]", "_", investor_name.lower())
        st.download_button(
            "Download outreach email (.txt)",
            data=f"Subject: {em.get('subject_line', '')}\n\n{em.get('body', '')}",
            file_name=f"outreach_{safe_name}.txt",
            mime="text/plain",
        )

        # ── Research Queries ───────────────────────────────────────────────
        sq = data.get("suggested_research_queries") or []
        if sq:
            with st.expander("Suggested Research Queries — dig deeper"):
                st.caption("Run these searches on Google, LinkedIn, or Crunchbase:")
                for q in sq:
                    st.markdown(f"- {q}")

        # ── Full Report Download ───────────────────────────────────────────
        st.markdown("---")
        full_report = format_investor_report(data, query)
        st.download_button(
            "Download Full Research Brief (.txt)",
            data=full_report,
            file_name=f"investor_brief_{safe_name}.txt",
            mime="text/plain",
            type="primary",
            use_container_width=True,
        )

        store.log_task_completed(
            task_type="investor_research",
            details={
                "investor_name": investor_name,
                "alignment_score": score,
                "confidence": conf_level,
            },
        )
        st.success("Research complete — brief saved to history.")


def run_ui() -> None:
    st.set_page_config(page_title="BillPilot", page_icon="💳", layout="wide")

    _render_sidebar()

    st.title("BillPilot")
    st.caption(
        "Debt negotiation scripts, FCRA credit dispute letters, and angel investor research — "
        "all generated from your actual data."
    )

    negotiate_tab, dispute_tab, payoff_tab, investor_tab, history_tab = st.tabs(
        ["Negotiation", "Credit Dispute", "Payoff Calculator", "Investor Research", "History"]
    )

    with negotiate_tab:
        _render_negotiation_tab()

    with dispute_tab:
        _render_credit_dispute_tab()

    with payoff_tab:
        _render_payoff_calculator_tab()

    with investor_tab:
        _render_investor_research_tab()

    with history_tab:
        _render_history_panel()


if __name__ == "__main__":
    run_ui()
