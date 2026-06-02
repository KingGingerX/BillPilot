"""Rita's Rewards — Restaurant Outreach Engine (Streamlit UI)."""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Optional

import streamlit as st

from .config import COMPANY_NAME, HUMAN_HANDOFF_THRESHOLD
from .database import (
    create_area, create_handoff, delete_area, delete_restaurant,
    get_area, get_area_stats, get_areas, get_email_history,
    get_handoffs, get_interest_events, get_restaurant, get_restaurants,
    init_db, log_email, update_handoff, update_restaurant, upsert_restaurant,
)
from .email_generator import generate_email
from .email_sender import is_configured, provider_label, send_email
from .funnel_engine import process_response, run_followup_batch, send_bulk, send_outreach
from .models import FUNNEL_STAGES, STATUS_COLORS
from .ranking import find_nearby, get_priority_targets, get_ranked_restaurants, qualify_nearby_from_interested, score_color, score_label

# ── Page config ────────────────────────────────────────────────────────────────

st.set_page_config(
    page_title="Rita's Rewards — Outreach Engine",
    page_icon="🍽️",
    layout="wide",
    initial_sidebar_state="expanded",
)

_CSS = """
<style>
/* Rita's Rewards brand palette */
:root {
    --rita-red: #E53E3E;
    --rita-gold: #F6AD55;
    --rita-dark: #1A1A2E;
    --rita-surface: #16213E;
    --rita-border: #2A2A4A;
}

/* Sidebar brand header */
.sidebar-brand {
    text-align: center;
    padding: 0.5rem 0 1.2rem;
    border-bottom: 1px solid var(--rita-border);
    margin-bottom: 1rem;
}
.sidebar-brand h2 { color: var(--rita-gold); font-size: 1.3rem; margin: 0; }
.sidebar-brand p  { color: #9CA3AF; font-size: 0.75rem; margin: 0.2rem 0 0; }

/* Stat cards */
.stat-card {
    background: #1E2A3A;
    border-radius: 8px;
    padding: 1rem 1.2rem;
    border-left: 4px solid var(--rita-gold);
    margin-bottom: 0.5rem;
}
.stat-card .stat-value { font-size: 2rem; font-weight: 700; color: var(--rita-gold); }
.stat-card .stat-label { font-size: 0.8rem; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; }

/* Status badges */
.badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
}

/* Score bar */
.score-bar-bg { background: #2D3748; border-radius: 4px; height: 8px; width: 100%; }
.score-bar-fill { height: 8px; border-radius: 4px; }

/* Activity feed */
.activity-item {
    border-left: 2px solid var(--rita-gold);
    padding: 0.4rem 0.8rem;
    margin-bottom: 0.4rem;
    font-size: 0.85rem;
    color: #CBD5E0;
}

/* Email preview box */
.email-preview {
    background: #1A1F2E;
    border: 1px solid var(--rita-border);
    border-radius: 8px;
    padding: 1rem 1.2rem;
    font-family: 'Courier New', monospace;
    font-size: 0.85rem;
    line-height: 1.6;
    white-space: pre-wrap;
    color: #E2E8F0;
}

/* Table rows */
.rest-row {
    background: #1E2535;
    border-radius: 6px;
    padding: 0.6rem 1rem;
    margin-bottom: 0.3rem;
    border: 1px solid #2A3547;
    cursor: pointer;
}
.rest-row:hover { border-color: var(--rita-gold); }
.rest-name { font-weight: 600; color: #F7FAFC; }
.rest-meta { font-size: 0.78rem; color: #718096; }
</style>
"""

st.markdown(_CSS, unsafe_allow_html=True)

# ── Init ───────────────────────────────────────────────────────────────────────

init_db()

if "selected_area_id" not in st.session_state:
    st.session_state.selected_area_id = None
if "selected_restaurant_id" not in st.session_state:
    st.session_state.selected_restaurant_id = None
if "generated_email" not in st.session_state:
    st.session_state.generated_email = None
if "compose_restaurant_id" not in st.session_state:
    st.session_state.compose_restaurant_id = None


# ── Sidebar ────────────────────────────────────────────────────────────────────

def _render_sidebar() -> Optional[int]:
    with st.sidebar:
        st.markdown("""
        <div class="sidebar-brand">
            <h2>🍽️ Rita's Rewards</h2>
            <p>Outreach Engine</p>
        </div>
        """, unsafe_allow_html=True)

        areas = get_areas()
        area_options = {a["name"]: a["id"] for a in areas}
        area_options["— All Areas —"] = None  # type: ignore[assignment]

        # Put "All Areas" first
        sorted_keys = ["— All Areas —"] + [k for k in area_options if k != "— All Areas —"]

        selected_name = st.selectbox("📍 Geographic Area", sorted_keys, key="area_select")
        area_id = area_options[selected_name]
        st.session_state.selected_area_id = area_id

        if st.button("➕ Add New Area", use_container_width=True):
            st.session_state.show_add_area = True

        st.divider()

        # Quick stats
        stats = get_area_stats(area_id)
        contacted_pct = f"{stats['contacted'] / max(stats['total'], 1) * 100:.0f}%"

        st.markdown("**PIPELINE**")
        cols = st.columns(2)
        cols[0].metric("🏪 Total", stats["total"])
        cols[1].metric("✉️ Contacted", f"{stats['contacted']} ({contacted_pct})")
        cols = st.columns(2)
        cols[0].metric("⭐ Interested", stats["interested"])
        cols[1].metric("🤝 Handoffs", stats["handoffs_pending"])

        st.divider()

        # Stage breakdown mini-chart
        if stats["stage_breakdown"]:
            st.markdown("**STAGE BREAKDOWN**")
            for stage, count in sorted(stats["stage_breakdown"].items(),
                                        key=lambda x: FUNNEL_STAGES.get(x[0], {}).get("sequence", 0)):
                label = FUNNEL_STAGES.get(stage, {}).get("label", stage)
                color = FUNNEL_STAGES.get(stage, {}).get("color", "#718096")
                st.markdown(
                    f'<span style="color:{color}">■</span> {label}: **{count}**',
                    unsafe_allow_html=True,
                )

        st.divider()
        if st.button("⚙️ Settings", use_container_width=True):
            st.session_state.active_tab = "settings"

    return area_id


# ── Dashboard Tab ──────────────────────────────────────────────────────────────

def _render_dashboard(area_id: Optional[int]) -> None:
    stats = get_area_stats(area_id)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("🏪 Restaurants", stats["total"])
    c2.metric("✉️ Contacted", stats["contacted"],
              delta=f"{stats['contacted'] / max(stats['total'], 1) * 100:.0f}% of total")
    c3.metric("⭐ Interested", stats["interested"],
              delta=f"+{stats['interested']} hot leads" if stats["interested"] else None)
    c4.metric("✅ Converted", stats["converted"])

    st.divider()

    col_left, col_right = st.columns([1.4, 1])

    with col_left:
        st.subheader("🏆 Top Leads")
        top = get_ranked_restaurants(area_id)[:8]
        if top:
            for r in top:
                score = r.get("interest_score", 0)
                stage = FUNNEL_STAGES.get(r.get("current_stage", ""), {}).get("label", "—")
                status_color = STATUS_COLORS.get(r.get("status", "uncontacted"), "#718096")
                st.markdown(
                    f"""<div class="rest-row">
                    <span class="rest-name">{r['name']}</span>
                    <span style="color:{status_color}; float:right">●</span><br>
                    <span class="rest-meta">{r.get('cuisine_type','') or ''} · {r.get('city','') or ''} · {stage}</span>
                    <div style="margin-top:4px">
                      <div class="score-bar-bg"><div class="score-bar-fill" style="width:{min(score,100)}%;background:{score_color(score)}"></div></div>
                    </div>
                    <span style="font-size:0.75rem;color:{score_color(score)}">{score_label(score)} ({score} pts)</span>
                    </div>""",
                    unsafe_allow_html=True,
                )
        else:
            st.info("No restaurants yet. Add an area and import restaurants to get started.")

    with col_right:
        st.subheader("🕐 Recent Activity")
        activity = stats.get("recent_activity", [])
        if activity:
            for item in activity:
                sent = item.get("sent_at", "")[:10]
                stage_label = FUNNEL_STAGES.get(item.get("stage", ""), {}).get("label", item.get("stage", ""))
                st.markdown(
                    f'<div class="activity-item"><b>{item.get("name","")}</b> — {stage_label}<br>'
                    f'<span style="color:#718096">{sent}</span></div>',
                    unsafe_allow_html=True,
                )
        else:
            st.caption("No emails sent yet.")

        st.divider()
        st.subheader("⚡ Quick Actions")
        if st.button("🔄 Run Follow-Up Batch", use_container_width=True, help="Auto-advance restaurants due for their next email"):
            with st.spinner("Processing follow-ups..."):
                results = run_followup_batch()
            if results:
                for r in results:
                    icon = "✅" if r.get("success") else "⚠️"
                    st.write(f"{icon} {r['name']} → {r.get('stage','dormant')}")
            else:
                st.info("No restaurants due for follow-up right now.")

        if st.button("📍 Qualify Nearby Restaurants", use_container_width=True,
                     help="Mark restaurants near interested leads as high-priority targets"):
            n = qualify_nearby_from_interested(area_id)
            st.success(f"Marked {n} new restaurants as nearby-qualified.")


# ── Restaurants Tab ────────────────────────────────────────────────────────────

def _render_restaurants(area_id: Optional[int]) -> None:
    col_f1, col_f2, col_f3, col_f4 = st.columns([2, 1.2, 1.2, 1])
    search = col_f1.text_input("🔍 Search", placeholder="Name, cuisine, city…")
    status_filter = col_f2.selectbox("Status", ["All", "uncontacted", "contacted", "interested",
                                                   "declined", "converted", "unsubscribed"])
    stage_filter = col_f3.selectbox("Stage", ["All"] + list(FUNNEL_STAGES.keys()))
    sort_by = col_f4.selectbox("Sort", ["Score ↓", "Name ↑", "Last Contact ↓"])

    restaurants = get_restaurants(
        area_id=area_id,
        status=None if status_filter == "All" else status_filter,
        stage=None if stage_filter == "All" else stage_filter,
        search=search or None,
    )

    if sort_by == "Name ↑":
        restaurants.sort(key=lambda r: r["name"].lower())
    elif sort_by == "Last Contact ↓":
        restaurants.sort(key=lambda r: r.get("last_contact_at") or "", reverse=True)
    # default: already sorted by score desc from DB

    st.caption(f"Showing {len(restaurants)} restaurant(s)")

    if not restaurants:
        st.info("No restaurants match the current filters. Use the Setup tab to add restaurants.")
        return

    # Two-panel layout: list + detail
    list_col, detail_col = st.columns([1.2, 1])

    with list_col:
        for r in restaurants:
            score = r.get("interest_score", 0)
            status_color = STATUS_COLORS.get(r.get("status", "uncontacted"), "#718096")
            stage = FUNNEL_STAGES.get(r.get("current_stage", ""), {}).get("label", "—")
            nearby_tag = " 📍" if r.get("nearby_qualified") else ""
            clicked = st.button(
                f"{'🔥' if score >= 80 else '⭐' if score >= 50 else '✉️' if score > 0 else '🔵'} "
                f"**{r['name']}**{nearby_tag}  \n"
                f"_{r.get('cuisine_type') or 'Restaurant'} · {r.get('city') or ''} · {stage}_",
                key=f"rest_{r['id']}",
                use_container_width=True,
            )
            if clicked:
                st.session_state.selected_restaurant_id = r["id"]

    with detail_col:
        rid = st.session_state.selected_restaurant_id
        if rid:
            _render_restaurant_detail(rid)
        else:
            st.info("← Select a restaurant to view details")


def _render_restaurant_detail(rid: int) -> None:
    r = get_restaurant(rid)
    if not r:
        st.warning("Restaurant not found.")
        return

    score = r.get("interest_score", 0)
    st.markdown(f"### {r['name']}")
    st.markdown(
        f'<span style="color:{score_color(score)}">{score_label(score)}</span> '
        f'· Score: **{score}**',
        unsafe_allow_html=True,
    )

    with st.expander("📋 Info", expanded=True):
        c1, c2 = st.columns(2)
        c1.write(f"**Cuisine:** {r.get('cuisine_type') or '—'}")
        c1.write(f"**Address:** {r.get('address') or '—'}")
        c1.write(f"**City:** {r.get('city') or '—'}, {r.get('state') or ''}")
        c1.write(f"**Phone:** {r.get('phone') or '—'}")
        c2.write(f"**Email:** {r.get('email') or '—'}")
        c2.write(f"**Website:** {r.get('website') or '—'}")
        c2.write(f"**Rating:** {r.get('rating') or '—'} ⭐ ({r.get('review_count') or 0} reviews)")
        c2.write(f"**Contact:** {r.get('contact_name') or '—'}")
        stage_label = FUNNEL_STAGES.get(r.get("current_stage", ""), {}).get("label", "Not started")
        c1.write(f"**Stage:** {stage_label}")
        c1.write(f"**Status:** {r.get('status', 'uncontacted').title()}")

    with st.expander("✏️ Edit Info"):
        with st.form(f"edit_rest_{rid}"):
            new_email = st.text_input("Email", value=r.get("email") or "")
            new_phone = st.text_input("Phone", value=r.get("phone") or "")
            new_contact = st.text_input("Contact Name", value=r.get("contact_name") or "")
            new_notes = st.text_area("Notes", value=r.get("notes") or "", height=80)
            new_status = st.selectbox("Status", ["uncontacted", "contacted", "interested",
                                                   "declined", "converted", "unsubscribed"],
                                       index=["uncontacted", "contacted", "interested",
                                              "declined", "converted", "unsubscribed"].index(
                                           r.get("status", "uncontacted")))
            if st.form_submit_button("Save"):
                update_restaurant(rid, email=new_email, phone=new_phone,
                                   contact_name=new_contact, notes=new_notes, status=new_status)
                st.success("Saved.")
                st.rerun()

    with st.expander("📬 Email History"):
        history = get_email_history(rid)
        if history:
            for e in history:
                sent = e.get("sent_at", "")[:10]
                stage_l = FUNNEL_STAGES.get(e.get("stage", ""), {}).get("label", e.get("stage", ""))
                resp = e.get("response_sentiment")
                resp_tag = f" · 📩 {resp.title()}" if resp else ""
                with st.container():
                    st.markdown(f"**{stage_l}** — {sent}{resp_tag}")
                    st.markdown(f"*{e.get('subject', '')}*")
                    if st.toggle(f"Show body", key=f"body_{e['id']}"):
                        st.text(e.get("body", ""))

                    if not e.get("response_at"):
                        with st.form(f"response_{e['id']}"):
                            resp_text = st.text_area("Log a response", height=60,
                                                      placeholder="Paste or type their reply…")
                            if st.form_submit_button("Record Response"):
                                if resp_text:
                                    sentiment = process_response(rid, e["id"], resp_text)
                                    st.success(f"Recorded as: {sentiment}")
                                    st.rerun()
                    st.divider()
        else:
            st.caption("No emails sent yet.")

    with st.expander("✉️ Send Email"):
        stage_choices = [s for s in FUNNEL_STAGES if s not in ("converted", "dormant")]
        chosen_stage = st.selectbox("Stage", stage_choices,
                                     key=f"stage_select_{rid}",
                                     format_func=lambda s: FUNNEL_STAGES[s]["label"])

        if st.button("🤖 Generate Email", key=f"gen_{rid}"):
            with st.spinner("Generating with Claude…"):
                email = generate_email(r, chosen_stage)
            st.session_state[f"gen_subject_{rid}"] = email["subject"]
            st.session_state[f"gen_body_{rid}"] = email["body"]

        subj = st.text_input("Subject", value=st.session_state.get(f"gen_subject_{rid}", ""),
                              key=f"subj_{rid}")
        body = st.text_area("Body", value=st.session_state.get(f"gen_body_{rid}", ""),
                             height=200, key=f"body_input_{rid}")

        provider = provider_label()
        configured = is_configured()

        if st.button(f"📤 Send via {provider}", key=f"send_{rid}",
                     disabled=not (subj and body)):
            to_email = r.get("email", "")
            if not to_email and provider != "Preview (not sent)":
                st.error("No email address on file for this restaurant.")
            else:
                result = send_email(to_email or "preview@ritasrewards.com",
                                     r.get("contact_name") or r["name"], subj, body)
                if result.success:
                    log_email(rid, chosen_stage, subj, body)
                    st.success("✅ Sent!" if not result.preview_only else "👁️ Preview mode — email not actually delivered.")
                    st.session_state[f"gen_subject_{rid}"] = ""
                    st.session_state[f"gen_body_{rid}"] = ""
                    st.rerun()
                else:
                    st.error(f"Failed: {result.error}")

    c1, c2 = st.columns(2)
    if c1.button("🤝 Create Handoff", key=f"handoff_{rid}",
                  help="Flag for human follow-up"):
        score = r.get("interest_score", 0)
        create_handoff(rid, None, min(10, max(1, score // 10)),
                        f"Manual handoff — score {score}")
        st.success("Added to handoff queue.")
        st.rerun()
    if c2.button("🗑️ Delete", key=f"del_{rid}", type="secondary"):
        delete_restaurant(rid)
        st.session_state.selected_restaurant_id = None
        st.rerun()


# ── Compose Tab ────────────────────────────────────────────────────────────────

def _render_compose(area_id: Optional[int]) -> None:
    st.subheader("✉️ Bulk Email Composer")

    restaurants = get_restaurants(area_id=area_id)
    if not restaurants:
        st.info("Add restaurants first.")
        return

    # Stage selector
    stage = st.selectbox(
        "Funnel Stage",
        [s for s in FUNNEL_STAGES if s not in ("converted", "dormant", "declined", "unsubscribed")],
        format_func=lambda s: FUNNEL_STAGES[s]["label"],
    )

    # Filter options
    filter_opts = ["All uncontacted", "All with email", "Nearby-qualified only", "Custom selection"]
    filter_mode = st.radio("Target", filter_opts, horizontal=True)

    target_restaurants = restaurants
    if filter_mode == "All uncontacted":
        target_restaurants = [r for r in restaurants if r["status"] == "uncontacted"]
    elif filter_mode == "All with email":
        target_restaurants = [r for r in restaurants if r.get("email")]
    elif filter_mode == "Nearby-qualified only":
        target_restaurants = [r for r in restaurants if r.get("nearby_qualified")]
    else:
        selected_names = st.multiselect(
            "Pick restaurants",
            [r["name"] for r in restaurants],
            key="custom_select",
        )
        target_restaurants = [r for r in restaurants if r["name"] in selected_names]

    st.caption(f"**{len(target_restaurants)}** restaurant(s) selected")
    has_email = sum(1 for r in target_restaurants if r.get("email"))
    no_email = len(target_restaurants) - has_email
    if no_email:
        st.warning(f"{no_email} restaurant(s) have no email address — those will be skipped on real sends.")

    # Preview a single email
    st.divider()
    st.markdown("**Preview (generated for first restaurant)**")

    preview_r = target_restaurants[0] if target_restaurants else None
    if preview_r and st.button("🤖 Generate Preview Email"):
        with st.spinner("Generating with Claude…"):
            email = generate_email(preview_r, stage)
        st.session_state.bulk_preview = email
        st.session_state.bulk_preview_name = preview_r["name"]

    if st.session_state.get("bulk_preview"):
        preview = st.session_state.bulk_preview
        st.text_input("Subject (preview)", value=preview["subject"], key="bulk_subj_prev", disabled=True)
        st.markdown(
            f'<div class="email-preview"><b>To:</b> {st.session_state.get("bulk_preview_name","")}\n'
            f'<b>Subject:</b> {preview["subject"]}\n\n{preview["body"]}</div>',
            unsafe_allow_html=True,
        )

    # Send
    st.divider()
    provider = provider_label()
    col1, col2 = st.columns([1, 3])
    send_clicked = col1.button(f"🚀 Send to {len(target_restaurants)} restaurants",
                                type="primary", use_container_width=True)
    col2.caption(f"Provider: **{provider}** — each restaurant gets a personalized email via Claude")

    if send_clicked:
        if not target_restaurants:
            st.warning("No restaurants selected.")
        else:
            progress = st.progress(0, text="Sending…")
            results = []
            for i, r in enumerate(target_restaurants):
                ok, msg, _ = send_outreach(r["id"], stage)
                results.append({"name": r["name"], "ok": ok, "msg": msg})
                progress.progress((i + 1) / len(target_restaurants),
                                   text=f"Sending {i+1}/{len(target_restaurants)}…")
                time.sleep(0.1)  # small delay to avoid rate limits

            progress.empty()
            ok_count = sum(1 for r in results if r["ok"])
            st.success(f"✅ Done — {ok_count}/{len(results)} emails sent")
            with st.expander("Send Log"):
                for r in results:
                    icon = "✅" if r["ok"] else "❌"
                    st.write(f"{icon} {r['name']} — {r['msg']}")


# ── Rankings Tab ───────────────────────────────────────────────────────────────

def _render_rankings(area_id: Optional[int]) -> None:
    st.subheader("📈 Interest Rankings")

    col1, col2 = st.columns([1, 1])
    col1.markdown("### 🔥 All Restaurants by Score")
    ranked = get_ranked_restaurants(area_id)

    for i, r in enumerate(ranked, 1):
        score = r.get("interest_score", 0)
        color = score_color(score)
        label = score_label(score)
        stage_label = FUNNEL_STAGES.get(r.get("current_stage", ""), {}).get("label", "Not started")
        col1.markdown(
            f"""<div style="display:flex;align-items:center;gap:12px;
                background:#1E2535;border-radius:6px;padding:8px 12px;margin-bottom:4px;
                border-left:3px solid {color}">
                <span style="color:#718096;font-size:0.8rem;min-width:20px">#{i}</span>
                <div style="flex:1">
                    <div style="font-weight:600">{r['name']}</div>
                    <div style="font-size:0.75rem;color:#718096">{r.get('city','') or ''} · {stage_label}</div>
                </div>
                <div style="text-align:right">
                    <div style="color:{color};font-weight:700">{score}</div>
                    <div style="font-size:0.7rem;color:{color}">{label}</div>
                </div>
            </div>""",
            unsafe_allow_html=True,
        )

    col2.markdown("### 🎯 Priority Targets (Uncontacted)")
    targets = get_priority_targets(area_id, limit=15)
    if targets:
        for r in targets:
            nearby_tag = " 📍 Nearby-Qualified" if r.get("nearby_qualified") else ""
            col2.markdown(
                f"**{r['name']}**{nearby_tag}  \n"
                f"_{r.get('cuisine_type') or 'Restaurant'} · {r.get('city') or ''}_  \n"
                f"Priority score: {r.get('priority_score', 0):.1f}"
            )
            if col2.button("✉️ Send Cold Email", key=f"prio_{r['id']}", use_container_width=False):
                ok, msg, email = send_outreach(r["id"], "cold_outreach")
                if ok:
                    st.success(f"Sent to {r['name']}!")
                else:
                    st.error(msg)
                st.rerun()
            col2.divider()
    else:
        col2.info("No uncontacted restaurants in this area.")

    # Nearby qualification trigger
    st.divider()
    c1, c2 = st.columns([2, 1])
    c1.markdown("**Qualify Nearby Restaurants** — marks restaurants within 2 miles of interested leads as high-priority targets")
    if c2.button("🗺️ Run Proximity Analysis"):
        n = qualify_nearby_from_interested(area_id)
        st.success(f"Marked {n} restaurant(s) as nearby-qualified.")


# ── Handoffs Tab ───────────────────────────────────────────────────────────────

def _render_handoffs() -> None:
    st.subheader("🤝 Human Follow-Up Queue")

    tab_pending, tab_done = st.tabs(["Pending", "Completed"])

    with tab_pending:
        handoffs = get_handoffs("pending")
        if not handoffs:
            st.success("Queue is empty! All high-interest leads have been handled.")
            return

        for h in handoffs:
            priority_color = "#E53E3E" if h["priority"] >= 8 else "#F6AD55" if h["priority"] >= 5 else "#48BB78"
            with st.container(border=True):
                c1, c2, c3 = st.columns([2, 1, 1])
                c1.markdown(f"### {h['restaurant_name']}")
                c1.caption(f"{h.get('cuisine_type','') or ''} · {h.get('city','') or ''}, {h.get('state','') or ''}")
                c1.write(f"📞 {h.get('phone') or '—'}  📧 {h.get('restaurant_email') or '—'}")
                c1.write(f"**Reason:** {h.get('reason','')}")

                c2.metric("Interest Score", h.get("interest_score", 0))
                c2.markdown(
                    f'<span style="color:{priority_color}">Priority: {h["priority"]}/10</span>',
                    unsafe_allow_html=True,
                )
                c2.caption(f"Created: {h.get('created_at','')[:10]}")

                with c3:
                    assignee = st.text_input("Assign to", value=h.get("assigned_to") or "",
                                              key=f"assign_{h['id']}", placeholder="Rep name")
                    notes = st.text_input("Notes", value=h.get("notes") or "",
                                           key=f"hnotes_{h['id']}", placeholder="Call notes…")
                    col_a, col_b = st.columns(2)
                    if col_a.button("✅ Complete", key=f"hcomplete_{h['id']}"):
                        update_handoff(h["id"], status="completed", assigned_to=assignee, notes=notes)
                        update_restaurant(h["restaurant_id"], status="converted", current_stage="converted")
                        st.success("Marked complete + restaurant converted!")
                        st.rerun()
                    if col_b.button("❌ Cancel", key=f"hcancel_{h['id']}"):
                        update_handoff(h["id"], status="cancelled")
                        st.rerun()

    with tab_done:
        completed = get_handoffs("completed")
        if completed:
            for h in completed:
                st.write(f"✅ **{h['restaurant_name']}** — {h.get('completed_at','')[:10]} — {h.get('assigned_to','')}")
        else:
            st.caption("No completed handoffs yet.")


# ── Setup Tab ──────────────────────────────────────────────────────────────────

def _render_setup(area_id: Optional[int]) -> None:
    st.subheader("⚙️ Setup & Configuration")

    tab_areas, tab_import, tab_manual, tab_settings = st.tabs(
        ["🗺️ Areas", "📥 Import CSV", "✏️ Add Manually", "🔑 Settings"]
    )

    with tab_areas:
        st.markdown("### Manage Geographic Areas")
        areas = get_areas()
        if areas:
            for a in areas:
                c1, c2 = st.columns([3, 1])
                c1.write(f"📍 **{a['name']}** — {a['city']}, {a['state']} · {a['radius_miles']} mi radius")
                if c2.button("🗑️ Delete", key=f"del_area_{a['id']}", type="secondary"):
                    delete_area(a["id"])
                    st.rerun()
        else:
            st.info("No areas yet. Add one below.")

        st.divider()
        st.markdown("### Add New Area")
        with st.form("add_area_form"):
            c1, c2 = st.columns(2)
            a_name = c1.text_input("Area Name *", placeholder="Downtown Austin")
            a_city = c2.text_input("City *", placeholder="Austin")
            c3, c4, c5 = st.columns(3)
            a_state = c3.text_input("State *", placeholder="TX")
            a_lat = c4.number_input("Latitude", value=30.2672, format="%.4f")
            a_lng = c5.number_input("Longitude", value=-97.7431, format="%.4f")
            a_radius = st.slider("Radius (miles)", 1, 25, 5)
            if st.form_submit_button("✅ Add Area"):
                if a_name and a_city and a_state:
                    create_area(a_name, a_city, a_state, a_lat, a_lng, a_radius)
                    st.success(f"Area '{a_name}' created!")
                    st.rerun()
                else:
                    st.error("Name, city, and state are required.")

    with tab_import:
        st.markdown("### Import Restaurants from CSV")
        from .restaurant_finder import csv_template, parse_csv
        st.download_button("⬇️ Download CSV Template", csv_template(),
                            file_name="ritas_rewards_restaurants.csv", mime="text/csv")
        uploaded = st.file_uploader("Upload CSV", type=["csv"])
        if uploaded:
            rows = parse_csv(uploaded.read())
            st.success(f"Parsed {len(rows)} restaurant(s). Preview:")
            st.dataframe(rows[:5], use_container_width=True)

            import_area = st.selectbox(
                "Assign to area",
                options=[None] + [a["id"] for a in get_areas()],
                format_func=lambda x: "— No area —" if x is None else
                    next((a["name"] for a in get_areas() if a["id"] == x), str(x)),
            )
            if st.button("📥 Import All"):
                count = 0
                for row in rows:
                    row["area_id"] = import_area
                    upsert_restaurant(row)
                    count += 1
                st.success(f"Imported {count} restaurant(s)!")
                st.rerun()

        st.markdown("---")
        st.markdown("### Discover via Google Places / Yelp")
        from .config import GOOGLE_PLACES_API_KEY, YELP_API_KEY
        if not GOOGLE_PLACES_API_KEY and not YELP_API_KEY:
            st.warning("Set `GOOGLE_PLACES_API_KEY` or `YELP_API_KEY` in your `.env` to enable automatic discovery.")
        else:
            areas_list = get_areas()
            if not areas_list:
                st.info("Add an area first.")
            else:
                disc_area_id = st.selectbox("Area to populate", [a["id"] for a in areas_list],
                                             format_func=lambda x: next(
                                                 (a["name"] for a in areas_list if a["id"] == x), str(x)))
                disc_cuisine = st.text_input("Cuisine keyword", "restaurant")
                if st.button("🔍 Search & Import Restaurants"):
                    area = get_area(disc_area_id)
                    if area:
                        from .restaurant_finder import search_google_places, search_yelp
                        with st.spinner("Searching…"):
                            results = (
                                search_google_places(area["lat"], area["lng"],
                                                      area["radius_miles"], disc_cuisine)
                                or search_yelp(area["lat"], area["lng"],
                                               area["radius_miles"], disc_cuisine)
                            )
                        st.info(f"Found {len(results)} restaurants. Importing…")
                        for row in results:
                            row["area_id"] = disc_area_id
                            upsert_restaurant(row)
                        st.success(f"Imported {len(results)} restaurants!")
                        st.rerun()

    with tab_manual:
        st.markdown("### Add a Single Restaurant")
        areas_list = get_areas()
        with st.form("manual_add"):
            m_name = st.text_input("Restaurant Name *")
            c1, c2 = st.columns(2)
            m_cuisine = c1.text_input("Cuisine Type", placeholder="Italian, Mexican…")
            m_contact = c2.text_input("Contact Name (Manager/Owner)")
            c3, c4 = st.columns(2)
            m_email = c3.text_input("Email Address")
            m_phone = c4.text_input("Phone")
            m_address = st.text_input("Street Address")
            c5, c6, c7 = st.columns(3)
            m_city = c5.text_input("City")
            m_state = c6.text_input("State")
            m_zip = c7.text_input("ZIP")
            m_website = st.text_input("Website")
            m_notes = st.text_area("Notes", height=60)
            m_area = st.selectbox(
                "Area",
                options=[None] + [a["id"] for a in areas_list],
                format_func=lambda x: "— No area —" if x is None else
                    next((a["name"] for a in areas_list if a["id"] == x), str(x)),
            )
            if st.form_submit_button("➕ Add Restaurant"):
                if m_name:
                    upsert_restaurant({
                        "name": m_name, "cuisine_type": m_cuisine,
                        "contact_name": m_contact, "email": m_email,
                        "phone": m_phone, "address": m_address,
                        "city": m_city, "state": m_state, "zip_code": m_zip,
                        "website": m_website, "notes": m_notes,
                        "area_id": m_area, "source": "manual",
                    })
                    st.success(f"Added {m_name}!")
                    st.rerun()
                else:
                    st.error("Name is required.")

    with tab_settings:
        st.markdown("### Configuration")
        from .config import (
            ANTHROPIC_API_KEY, EMAIL_PROVIDER, FROM_EMAIL, FROM_NAME,
            GOOGLE_PLACES_API_KEY, PROGRAM_URL, SENDGRID_API_KEY, YELP_API_KEY,
        )

        def _status(val: str, label: str) -> str:
            if val:
                return f"✅ {label}: configured"
            return f"❌ {label}: **not set** — add to `.env`"

        st.markdown(_status(ANTHROPIC_API_KEY, "Anthropic Claude (AI emails)"))
        st.markdown(_status(FROM_EMAIL, "From Email"))
        if EMAIL_PROVIDER == "sendgrid":
            st.markdown(_status(SENDGRID_API_KEY, "SendGrid"))
        elif EMAIL_PROVIDER == "smtp":
            from .config import SMTP_USERNAME
            st.markdown(_status(SMTP_USERNAME, "SMTP"))
        else:
            st.info("📧 Email provider set to **preview mode** — emails won't be delivered. "
                    "Set `R2R_EMAIL_PROVIDER=sendgrid` or `smtp` in `.env`.")
        st.markdown(_status(GOOGLE_PLACES_API_KEY, "Google Places API"))
        st.markdown(_status(YELP_API_KEY, "Yelp Fusion API"))

        st.divider()
        st.markdown("**Environment Variables Reference**")
        env_ref = """
| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI for email generation |
| `R2R_FROM_EMAIL` | Sender email address |
| `R2R_FROM_NAME` | Sender display name |
| `R2R_SENDER_NAME` | Sender first name in emails |
| `R2R_EMAIL_PROVIDER` | `sendgrid` / `smtp` / `preview` |
| `SENDGRID_API_KEY` | SendGrid API key |
| `R2R_SMTP_HOST` | SMTP host (default: smtp.gmail.com) |
| `R2R_SMTP_PORT` | SMTP port (default: 587) |
| `R2R_SMTP_USERNAME` | SMTP username |
| `R2R_SMTP_PASSWORD` | SMTP password / app password |
| `GOOGLE_PLACES_API_KEY` | Google Places restaurant search |
| `YELP_API_KEY` | Yelp Fusion restaurant search |
| `R2R_HANDOFF_THRESHOLD` | Score to trigger human handoff (default: 60) |
| `R2R_PROGRAM_URL` | Rita's Rewards signup URL |
| `R2R_DATABASE_PATH` | SQLite database path |
"""
        st.markdown(env_ref)


# ── Main ───────────────────────────────────────────────────────────────────────

def main() -> None:
    area_id = _render_sidebar()

    area_name = "All Areas"
    if area_id:
        a = get_area(area_id)
        area_name = a["name"] if a else "Selected Area"

    st.title(f"🍽️ {COMPANY_NAME} Outreach Engine")
    st.caption(f"Area: **{area_name}**")

    tab_labels = ["🏠 Dashboard", "🍽️ Restaurants", "✉️ Compose", "📈 Rankings", "🤝 Handoffs", "⚙️ Setup"]
    tabs = st.tabs(tab_labels)

    with tabs[0]: _render_dashboard(area_id)
    with tabs[1]: _render_restaurants(area_id)
    with tabs[2]: _render_compose(area_id)
    with tabs[3]: _render_rankings(area_id)
    with tabs[4]: _render_handoffs()
    with tabs[5]: _render_setup(area_id)


if __name__ == "__main__":
    main()
