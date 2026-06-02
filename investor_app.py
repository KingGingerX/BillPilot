"""
InvestorIQ — Standalone Angel Investor Research App
Run via:  streamlit run investor_app.py
Or use:   ./launch.sh  (Mac/Linux)   launch.bat  (Windows)
"""
from __future__ import annotations

import os
import re

import streamlit as st

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Page config — must be the very first Streamlit call ──────────────────────
st.set_page_config(
    page_title="InvestorIQ — Angel Investor Research",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS ───────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* ── Global ── */
html, body, [class*="css"] { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
#MainMenu, footer, header { visibility: hidden; }
.stDeployButton { display: none !important; }
.stApp { background-color: #0d1117; }
.block-container { padding: 0 2.5rem 3rem 2.5rem; max-width: 1180px; }

/* ── Inputs ── */
.stTextInput > div > div > input,
.stTextArea > div > div > textarea,
.stSelectbox > div > div > div {
    background-color: #161b22 !important;
    border: 1px solid #30363d !important;
    color: #e6edf3 !important;
    border-radius: 8px !important;
    font-size: 0.95rem !important;
}
.stTextInput > div > div > input:focus,
.stTextArea > div > div > textarea:focus {
    border-color: #6366f1 !important;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18) !important;
    outline: none !important;
}
.stTextInput > label, .stTextArea > label, .stSelectbox > label {
    color: #8b949e !important;
    font-size: 0.78rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.06em !important;
}

/* ── Buttons ── */
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%) !important;
    border: none !important;
    border-radius: 10px !important;
    padding: 0.75rem 1.5rem !important;
    font-size: 1rem !important;
    font-weight: 600 !important;
    color: #fff !important;
    letter-spacing: 0.01em !important;
    transition: all 0.2s ease !important;
    box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3) !important;
}
.stButton > button[kind="primary"]:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.45) !important;
}
.stButton > button[kind="secondary"] {
    background: transparent !important;
    border: 1px solid #30363d !important;
    color: #8b949e !important;
    border-radius: 8px !important;
}
.stDownloadButton > button {
    background-color: #21262d !important;
    border: 1px solid #30363d !important;
    color: #e6edf3 !important;
    border-radius: 8px !important;
    font-weight: 500 !important;
}
.stDownloadButton > button:hover {
    border-color: #6366f1 !important;
    background-color: #1c2030 !important;
}

/* ── Metrics ── */
[data-testid="stMetricValue"] {
    color: #e6edf3 !important;
    font-size: 1.1rem !important;
    font-weight: 700 !important;
}
[data-testid="stMetricLabel"] {
    color: #6e7681 !important;
    font-size: 0.75rem !important;
    font-weight: 600 !important;
    text-transform: uppercase !important;
    letter-spacing: 0.05em !important;
}
[data-testid="metric-container"] {
    background: #161b22 !important;
    border: 1px solid #30363d !important;
    border-radius: 10px !important;
    padding: 14px 16px !important;
}

/* ── Expanders ── */
details > summary {
    background-color: #161b22 !important;
    border: 1px solid #30363d !important;
    border-radius: 10px !important;
    color: #e6edf3 !important;
    padding: 12px 16px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
}
details[open] > summary { border-radius: 10px 10px 0 0 !important; }
details > div {
    background-color: #161b22 !important;
    border: 1px solid #30363d !important;
    border-top: none !important;
    border-radius: 0 0 10px 10px !important;
    padding: 16px !important;
}
.streamlit-expanderHeader {
    background-color: #161b22 !important;
    border: 1px solid #30363d !important;
    border-radius: 10px !important;
    color: #e6edf3 !important;
    font-weight: 600 !important;
}
.streamlit-expanderContent {
    background-color: #161b22 !important;
    border: 1px solid #30363d !important;
    border-top: none !important;
    border-radius: 0 0 10px 10px !important;
}

/* ── Progress / spinner ── */
.stProgress > div > div > div { background: linear-gradient(90deg, #6366f1, #8b5cf6) !important; }
.stSpinner > div { border-top-color: #6366f1 !important; }
[data-testid="stStatusWidget"] { color: #8b949e !important; }

/* ── Alerts ── */
.stAlert { border-radius: 10px !important; border: none !important; }
[data-testid="stNotification"] { border-radius: 10px !important; }

/* ── Divider ── */
hr { border-color: #21262d !important; margin: 1.5rem 0 !important; }

/* ── Code blocks ── */
code, .stCode { font-size: 0.88rem !important; }
.stCodeBlock { border-radius: 10px !important; }

/* ── Markdown text ── */
.stMarkdown p, .stMarkdown li { color: #c9d1d9 !important; line-height: 1.65 !important; }
.stMarkdown h1, .stMarkdown h2, .stMarkdown h3 { color: #e6edf3 !important; }
.stMarkdown strong { color: #e6edf3 !important; }
.stMarkdown a { color: #58a6ff !important; }

/* ── Sidebar (collapsed) ── */
section[data-testid="stSidebar"] { background: #161b22 !important; }
</style>
""", unsafe_allow_html=True)

# ── Lazy imports (don't crash if missing at boot) ─────────────────────────────
from debt_bot.investor_research import InvestorQuery, format_investor_report, research_investor
from debt_bot.web_search import search_investor_web

# ── Helpers ───────────────────────────────────────────────────────────────────

def _tag(text: str, color: str, bg: str, border: str) -> str:
    return (
        f'<span style="display:inline-block;padding:3px 10px;border-radius:20px;'
        f'font-size:12px;font-weight:600;margin:2px 3px 2px 0;'
        f'color:{color};background:{bg};border:1px solid {border};">{text}</span>'
    )


def _focus_tag(text: str) -> str:
    return _tag(text, "#79c0ff", "#0d2145", "#1f4280")


def _flag_tag(text: str) -> str:
    return _tag(text, "#ffa657", "#2d1b00", "#5a3800")


def _green_tag(text: str) -> str:
    return _tag(text, "#56d364", "#0d2b1e", "#1a4d34")


def _section(title: str, icon: str = "") -> None:
    st.markdown(
        f'<h3 style="color:#e6edf3;font-size:1.1rem;font-weight:700;'
        f'margin:1.5rem 0 0.75rem 0;padding-bottom:8px;'
        f'border-bottom:1px solid #21262d;">'
        f'{icon}&nbsp; {title}</h3>',
        unsafe_allow_html=True,
    )


def _info_box(text: str, color: str = "#6366f1") -> None:
    st.markdown(
        f'<div style="background:rgba(99,102,241,0.08);border-left:3px solid {color};'
        f'border-radius:0 8px 8px 0;padding:14px 18px;margin:8px 0;">'
        f'<span style="color:#c9d1d9;font-size:0.97rem;line-height:1.6;">{text}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )


def _bullet_list(items: list[str], icon: str = "•", color: str = "#8b949e") -> None:
    if not items:
        st.markdown(f'<p style="color:#6e7681;font-style:italic;">Not available</p>',
                    unsafe_allow_html=True)
        return
    html = "".join(
        f'<li style="color:#c9d1d9;margin-bottom:6px;line-height:1.5;">'
        f'<span style="color:{color};margin-right:8px;">{icon}</span>{item}</li>'
        for item in items
    )
    st.markdown(f'<ul style="list-style:none;padding:0;margin:0;">{html}</ul>',
                unsafe_allow_html=True)


# ── Header ────────────────────────────────────────────────────────────────────

st.markdown("""
<div style="background:linear-gradient(180deg,#161b22 0%,#0d1117 100%);
            border-bottom:1px solid #21262d;padding:28px 0 24px 0;
            margin:-1rem -2.5rem 2rem -2.5rem;text-align:center;">
  <div style="display:inline-flex;align-items:center;gap:14px;">
    <span style="font-size:2.2rem;">🎯</span>
    <div style="text-align:left;">
      <h1 style="margin:0;font-size:2rem;font-weight:800;
                 background:linear-gradient(135deg,#e6edf3,#8b949e);
                 -webkit-background-clip:text;-webkit-text-fill-color:transparent;
                 background-clip:text;">InvestorIQ</h1>
      <p style="margin:0;color:#6e7681;font-size:0.9rem;font-weight:500;
                letter-spacing:0.04em;">ANGEL INVESTOR RESEARCH &amp; PITCH INTELLIGENCE</p>
    </div>
  </div>
</div>
""", unsafe_allow_html=True)

# ── API key banner ────────────────────────────────────────────────────────────
api_key = os.getenv("ANTHROPIC_API_KEY", "")
if not api_key:
    st.markdown("""
    <div style="background:#1c1200;border:1px solid #5a3800;border-radius:10px;
                padding:14px 18px;margin-bottom:20px;">
      <span style="color:#ffa657;font-weight:700;">⚠ ANTHROPIC_API_KEY not set</span>
      <span style="color:#c9d1d9;"> — Add it to your <code>.env</code> file to enable AI analysis.
      Get a key at <strong>console.anthropic.com</strong></span>
    </div>
    """, unsafe_allow_html=True)

# ── Form ──────────────────────────────────────────────────────────────────────
st.markdown("""
<h2 style="color:#e6edf3;font-size:1.3rem;font-weight:700;margin-bottom:1rem;">
  Research an Angel Investor
</h2>
""", unsafe_allow_html=True)

col_inv, col_sep, col_venture = st.columns([5, 0.3, 5])

with col_inv:
    st.markdown(
        '<p style="color:#6366f1;font-size:0.75rem;font-weight:700;'
        'text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">'
        '◆ Investor</p>',
        unsafe_allow_html=True,
    )
    investor_name = st.text_input(
        "Investor name *",
        placeholder="e.g. Naval Ravikant",
        key="inv_name",
    )
    firm = st.text_input(
        "Firm / affiliation (optional)",
        placeholder="e.g. AngelList, a16z, independent",
        key="inv_firm",
    )
    investor_notes = st.text_area(
        "Notes you've already gathered (optional)",
        placeholder=(
            "Paste anything helpful: LinkedIn bio, blog posts, tweets, "
            "portfolio list, interview excerpts, conference talks…"
        ),
        height=110,
        key="inv_notes",
    )

with col_sep:
    st.markdown(
        '<div style="width:1px;background:#21262d;min-height:300px;'
        'margin:24px auto 0 auto;"></div>',
        unsafe_allow_html=True,
    )

with col_venture:
    st.markdown(
        '<p style="color:#8b5cf6;font-size:0.75rem;font-weight:700;'
        'text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">'
        '◆ Your Venture</p>',
        unsafe_allow_html=True,
    )
    venture_name = st.text_input(
        "Venture name *",
        placeholder="e.g. CleanSlate Health",
        key="ven_name",
    )
    venture_description = st.text_area(
        "What you're building *",
        placeholder="2–3 sentences: what it does, who it serves, and how it works.",
        height=80,
        key="ven_desc",
    )
    col_s, col_st = st.columns(2)
    with col_s:
        sector = st.text_input(
            "Sector *",
            placeholder="e.g. HealthTech, CleanEnergy",
            key="ven_sector",
        )
    with col_st:
        stage = st.selectbox(
            "Stage *",
            ["Pre-Seed", "Seed", "Series A", "Series B+", "Pre-Idea / Concept"],
            key="ven_stage",
        )
    good_cause = st.text_area(
        "Mission — why it matters *",
        placeholder=(
            "Why does this venture exist? What problem does it solve? "
            "What impact does it create for people or the planet?"
        ),
        height=80,
        key="ven_mission",
    )

st.markdown("<br>", unsafe_allow_html=True)

# ── Search toggles ────────────────────────────────────────────────────────────
col_btn, col_opt = st.columns([3, 2])
with col_opt:
    enable_web_search = st.toggle(
        "Enable live web search",
        value=True,
        help=(
            "Searches the web for current info about this investor. "
            "Requires duckduckgo-search package. Adds ~15 seconds but dramatically "
            "improves accuracy for well-known investors."
        ),
    )

with col_btn:
    do_research = st.button(
        "🔍  Research Investor & Build Pitch Strategy",
        type="primary",
        use_container_width=True,
        disabled=not api_key,
    )

# ── Research logic ────────────────────────────────────────────────────────────
if do_research:
    missing = [
        label for label, val in [
            ("Investor name", investor_name),
            ("Venture name", venture_name),
            ("What you're building", venture_description),
            ("Sector", sector),
            ("Mission / why it matters", good_cause),
        ] if not val.strip()
    ]
    if missing:
        st.error(f"Please fill in: {', '.join(missing)}")
        st.stop()

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
        st.error(f"Validation error: {e}")
        st.stop()

    # ── Progress ──────────────────────────────────────────────────────────────
    web_context = ""
    with st.status(f"Researching **{investor_name}**…", expanded=True) as status:
        if enable_web_search:
            progress_placeholder = st.empty()

            def update_progress(msg: str) -> None:
                progress_placeholder.markdown(
                    f'<span style="color:#8b949e;font-size:0.88rem;">🔍 {msg}</span>',
                    unsafe_allow_html=True,
                )

            st.write("🌐 Searching the web for current information…")
            try:
                web_context = search_investor_web(
                    name=investor_name,
                    firm=firm,
                    extra_notes=investor_notes,
                    on_progress=update_progress,
                )
                progress_placeholder.empty()
                web_lines = web_context.count("\n")
                st.write(f"✅ Web research complete ({web_lines} lines gathered)")
            except Exception as e:
                st.write(f"⚠ Web search failed ({e}) — proceeding with AI training data only")
                web_context = ""
        else:
            st.write("⏭ Web search skipped — using AI training knowledge only")

        st.write("🧠 Analyzing with Claude AI…")
        try:
            data = research_investor(query, web_context)
        except Exception as e:
            status.update(label="Research failed", state="error")
            st.error(f"AI analysis failed: {e}")
            st.stop()

        status.update(label="Research complete!", state="complete", expanded=False)

    st.divider()

    # ── Investor Overview Card ────────────────────────────────────────────────
    conf = data.get("data_confidence", {})
    conf_level = (conf.get("level") or "unknown").lower()
    conf_badge_color = {"high": "#3fb950", "medium": "#e3b341", "low": "#f85149"}.get(
        conf_level, "#8b949e"
    )
    score = data.get("venture_alignment_score")

    st.markdown(f"""
    <div style="background:linear-gradient(135deg,#161b22,#0d1117);
                border:1px solid #30363d;border-radius:14px;
                padding:24px 28px;margin-bottom:20px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="color:#e6edf3;font-size:1.6rem;font-weight:800;margin:0 0 4px 0;">
            {data.get('name', investor_name)}
          </h2>
          <p style="color:#8b949e;margin:0;font-size:0.95rem;">
            {data.get('firm_or_affiliation', '') or '&nbsp;'}
            {'&nbsp;&nbsp;·&nbsp;&nbsp;' + data.get('location','') if data.get('location') else ''}
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="background:#0d2b1e;color:{conf_badge_color};border:1px solid {conf_badge_color}33;
                        border-radius:20px;padding:4px 12px;font-size:0.78rem;font-weight:700;
                        text-transform:uppercase;letter-spacing:0.05em;">
            {conf_level} confidence
          </span>
          {
          (f'<span style="background:linear-gradient(135deg,#1a2740,#1a2035);color:#79c0ff;'
           f'border:1px solid #2d4a7a;border-radius:20px;padding:4px 14px;'
           f'font-size:1.1rem;font-weight:800;">'
           f'Fit: {score}/10</span>')
          if score is not None else ''
          }
        </div>
      </div>
      {('<p style="color:#8b6914;background:#1a1200;border:1px solid #3d2e00;border-radius:8px;'
        'padding:10px 14px;margin:12px 0 0 0;font-size:0.88rem;">'
        '⚠ ' + conf.get("note","") + '</p>')
       if conf_level == "low" and conf.get("note") else ''}
    </div>
    """, unsafe_allow_html=True)

    # Key stats row
    m1, m2, m3, m4 = st.columns(4)
    m1.metric("Stage Focus", data.get("investment_stage") or "—")
    m2.metric("Typical Check", data.get("typical_check_size") or "—")
    m3.metric("Geography", data.get("geographic_preference") or "—")
    if score is not None:
        m4.metric("Venture Fit Score", f"{score} / 10")
    else:
        m4.metric("Venture Fit Score", "—")

    # ── Alignment score bar ───────────────────────────────────────────────────
    if score is not None:
        st.markdown("<br>", unsafe_allow_html=True)
        pct = int(score) * 10
        bar_color = (
            "#3fb950" if score >= 7 else
            "#e3b341" if score >= 5 else
            "#f85149"
        )
        st.markdown(f"""
        <div style="background:#161b22;border:1px solid #30363d;border-radius:12px;padding:20px 24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#e6edf3;font-weight:700;font-size:1rem;">Venture Alignment</span>
            <span style="color:{bar_color};font-size:1.8rem;font-weight:800;">{score}<span style="font-size:1rem;color:#6e7681;">/10</span></span>
          </div>
          <div style="background:#21262d;border-radius:6px;height:10px;overflow:hidden;">
            <div style="width:{pct}%;height:100%;
                        background:linear-gradient(90deg,{bar_color}aa,{bar_color});
                        border-radius:6px;transition:width 0.5s ease;"></div>
          </div>
          <p style="color:#8b949e;font-size:0.9rem;margin:12px 0 0 0;line-height:1.6;">
            {data.get('venture_alignment_rationale','Not available')}
          </p>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    # ── Biography & Focus ─────────────────────────────────────────────────────
    with st.expander("📋  Biography & Investment Focus", expanded=True):
        col_a, col_b = st.columns([3, 2])
        with col_a:
            st.markdown('<p style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px;">Biography</p>',
                        unsafe_allow_html=True)
            st.markdown(f'<p style="color:#c9d1d9;line-height:1.7;">'
                        f'{data.get("bio_summary","Not available")}</p>',
                        unsafe_allow_html=True)
            st.markdown('<p style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 6px 0;">Background</p>',
                        unsafe_allow_html=True)
            st.markdown(f'<p style="color:#c9d1d9;line-height:1.7;">'
                        f'{data.get("professional_background","Not available")}</p>',
                        unsafe_allow_html=True)

        with col_b:
            st.markdown('<p style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Focus Areas</p>',
                        unsafe_allow_html=True)
            focus = data.get("investment_focus") or []
            if focus:
                tags_html = "".join(_focus_tag(f) for f in focus)
                st.markdown(f'<div style="line-height:2;">{tags_html}</div>', unsafe_allow_html=True)
            else:
                st.markdown('<p style="color:#6e7681;font-style:italic;">Not available</p>',
                            unsafe_allow_html=True)

            st.markdown('<p style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 8px 0;">Notable Investments</p>',
                        unsafe_allow_html=True)
            _bullet_list(data.get("notable_investments") or [], "→", "#58a6ff")

        if data.get("recent_themes"):
            st.markdown('<p style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 6px 0;">Recent Themes & Priorities</p>',
                        unsafe_allow_html=True)
            _info_box(data["recent_themes"], "#e3b341")

        quotes = data.get("quotes") or []
        if quotes:
            for q in quotes:
                st.markdown(
                    f'<blockquote style="border-left:3px solid #30363d;padding:10px 16px;'
                    f'margin:10px 0;color:#8b949e;font-style:italic;">"{q}"</blockquote>',
                    unsafe_allow_html=True,
                )

    # ── Investment Criteria ───────────────────────────────────────────────────
    with st.expander("🔎  Investment Criteria & Red Flags"):
        col_a, col_b = st.columns(2)
        with col_a:
            st.markdown('<p style="color:#3fb950;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">What They Look For</p>',
                        unsafe_allow_html=True)
            _bullet_list(data.get("what_they_look_for") or [], "✓", "#3fb950")

            st.markdown('<p style="color:#58a6ff;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin:14px 0 8px 0;">Founder Preferences</p>',
                        unsafe_allow_html=True)
            _bullet_list(data.get("founder_preferences") or [], "★", "#58a6ff")

        with col_b:
            st.markdown('<p style="color:#f85149;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Red Flags — Will Pass On</p>',
                        unsafe_allow_html=True)
            flags = data.get("red_flags") or []
            flag_tags = "".join(_flag_tag(f) for f in flags)
            if flag_tags:
                st.markdown(f'<div style="line-height:2.2;">{flag_tags}</div>', unsafe_allow_html=True)
            else:
                _bullet_list([], "", "")

    # ── Contact Intelligence ──────────────────────────────────────────────────
    with st.expander("📬  Contact Intelligence"):
        cc = data.get("contact_channels") or {}
        col_a, col_b = st.columns([1, 2])
        with col_a:
            for label, key, icon in [
                ("LinkedIn", "linkedin", "🔗"),
                ("Twitter / X", "twitter", "🐦"),
                ("Website", "website", "🌐"),
                ("Email", "email", "✉️"),
            ]:
                val = cc.get(key) or "Not available"
                st.markdown(
                    f'<div style="margin-bottom:10px;">'
                    f'<span style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                    f'text-transform:uppercase;letter-spacing:0.06em;">{label}</span><br>'
                    f'<span style="color:#c9d1d9;font-size:0.93rem;">{icon} {val}</span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
        with col_b:
            st.markdown('<p style="color:#6e7681;font-size:0.78rem;font-weight:700;'
                        'text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Best Approach</p>',
                        unsafe_allow_html=True)
            _info_box(cc.get("best_approach") or "Not available", "#6366f1")

    # ── Pitch Strategy ────────────────────────────────────────────────────────
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("""
    <div style="background:linear-gradient(135deg,#0d1a2d,#0d1117);
                border:1px solid #1f3a5f;border-radius:14px;
                padding:22px 26px 16px 26px;margin-bottom:4px;">
      <h3 style="color:#79c0ff;font-size:1.15rem;font-weight:800;margin:0 0 4px 0;">
        🎯 Pitch Strategy
      </h3>
      <p style="color:#6e7681;font-size:0.85rem;margin:0;">
        Tailored specifically for {investor_name} based on their known interests.
      </p>
    </div>
    """.replace("{investor_name}", investor_name), unsafe_allow_html=True)

    ps = data.get("pitch_strategy") or {}

    # Opening hook — most prominent
    hook = ps.get("headline_hook") or "Not available"
    st.markdown(f"""
    <div style="background:rgba(99,102,241,0.1);border:1px solid #6366f1;
                border-radius:12px;padding:20px 24px;margin:16px 0;">
      <p style="color:#6e7681;font-size:0.75rem;font-weight:700;text-transform:uppercase;
                letter-spacing:0.08em;margin:0 0 8px 0;">⚡ Opening Hook</p>
      <p style="color:#e6edf3;font-size:1.05rem;font-weight:600;line-height:1.6;margin:0;">
        "{hook}"
      </p>
    </div>
    """, unsafe_allow_html=True)

    col_a, col_b = st.columns(2)
    with col_a:
        _section("Key Alignment Points", "🔗")
        _bullet_list(ps.get("key_alignment_points") or [], "◆", "#6366f1")

        _section("Metrics to Lead With", "📈")
        _bullet_list(ps.get("metrics_to_lead_with") or [], "→", "#3fb950")

        _section("Questions to Ask Them", "❓")
        _bullet_list(ps.get("questions_to_ask_them") or [], "?", "#e3b341")

    with col_b:
        _section("Core Talking Points", "💬")
        _bullet_list(ps.get("core_talking_points") or [], "•", "#58a6ff")

        _section("Things to Avoid", "🚫")
        avoid = ps.get("things_to_avoid") or []
        avoid_tags = "".join(_flag_tag(a) for a in avoid)
        if avoid_tags:
            st.markdown(f'<div style="line-height:2.2;">{avoid_tags}</div>', unsafe_allow_html=True)
        else:
            st.markdown('<p style="color:#6e7681;font-style:italic;">Not available</p>',
                        unsafe_allow_html=True)

    _section("Follow-Up Strategy", "📅")
    _info_box(ps.get("follow_up_strategy") or "Not available", "#3fb950")

    # ── Outreach Email ────────────────────────────────────────────────────────
    st.markdown("<br>", unsafe_allow_html=True)
    _section("Cold Outreach Email Template", "✉️")

    em = data.get("outreach_email") or {}
    subject = em.get("subject_line") or ""
    body = em.get("body") or "Not available"

    st.markdown(
        f'<div style="background:#161b22;border:1px solid #30363d;border-radius:8px 8px 0 0;'
        f'padding:10px 16px;">'
        f'<span style="color:#6e7681;font-size:0.75rem;font-weight:700;'
        f'text-transform:uppercase;letter-spacing:0.06em;">Subject: </span>'
        f'<span style="color:#e6edf3;font-weight:600;">{subject}</span>'
        f'</div>',
        unsafe_allow_html=True,
    )
    st.code(body, language=None)

    safe_name = re.sub(r"[^a-z0-9_]", "_", investor_name.lower())
    col_dl1, col_dl2 = st.columns(2)
    with col_dl1:
        st.download_button(
            "⬇  Download outreach email (.txt)",
            data=f"Subject: {subject}\n\n{body}",
            file_name=f"outreach_{safe_name}.txt",
            mime="text/plain",
            use_container_width=True,
        )

    # ── Research Queries ──────────────────────────────────────────────────────
    sq = data.get("suggested_research_queries") or []
    if sq:
        with st.expander("🔍  Suggested Research Queries — dig deeper"):
            st.caption("Run these searches on Google, LinkedIn, Crunchbase, or AngelList:")
            _bullet_list(sq, "🔍", "#58a6ff")

    # ── Full report download ──────────────────────────────────────────────────
    st.markdown("<br>", unsafe_allow_html=True)
    full_report = format_investor_report(data, query)
    col_dl_main, _ = st.columns([3, 2])
    with col_dl_main:
        st.download_button(
            "⬇  Download Full Research Brief (.txt)",
            data=full_report,
            file_name=f"investor_brief_{safe_name}.txt",
            mime="text/plain",
            type="primary",
            use_container_width=True,
        )

    # ── Footer ────────────────────────────────────────────────────────────────
    st.markdown("""
    <div style="margin-top:3rem;padding:16px 0;border-top:1px solid #21262d;
                text-align:center;color:#6e7681;font-size:0.8rem;">
      Research generated by AI based on publicly available information.
      Always verify before outreach — investor preferences change.
      Not financial or investment advice.
    </div>
    """, unsafe_allow_html=True)

# ── Empty state ───────────────────────────────────────────────────────────────
else:
    st.markdown("""
    <div style="text-align:center;padding:3rem 1rem;color:#6e7681;">
      <div style="font-size:3rem;margin-bottom:1rem;">🎯</div>
      <p style="font-size:1rem;max-width:500px;margin:0 auto;line-height:1.7;">
        Fill in the investor name and your venture details above, then click
        <strong style="color:#e6edf3;">Research Investor</strong> to generate
        a comprehensive intelligence brief and tailored pitch strategy.
      </p>
      <div style="display:flex;justify-content:center;gap:24px;margin-top:2rem;flex-wrap:wrap;">
        <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;
                    padding:14px 20px;min-width:160px;">
          <div style="color:#6366f1;font-size:1.3rem;margin-bottom:4px;">🌐</div>
          <div style="color:#e6edf3;font-weight:600;font-size:0.9rem;">Live Web Search</div>
          <div style="color:#6e7681;font-size:0.8rem;margin-top:2px;">Real-time investor data</div>
        </div>
        <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;
                    padding:14px 20px;min-width:160px;">
          <div style="color:#8b5cf6;font-size:1.3rem;margin-bottom:4px;">🧠</div>
          <div style="color:#e6edf3;font-weight:600;font-size:0.9rem;">AI Analysis</div>
          <div style="color:#6e7681;font-size:0.8rem;margin-top:2px;">Claude-powered synthesis</div>
        </div>
        <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;
                    padding:14px 20px;min-width:160px;">
          <div style="color:#3fb950;font-size:1.3rem;margin-bottom:4px;">🎯</div>
          <div style="color:#e6edf3;font-weight:600;font-size:0.9rem;">Pitch Strategy</div>
          <div style="color:#6e7681;font-size:0.8rem;margin-top:2px;">Tailored to each investor</div>
        </div>
        <div style="background:#161b22;border:1px solid #30363d;border-radius:10px;
                    padding:14px 20px;min-width:160px;">
          <div style="color:#e3b341;font-size:1.3rem;margin-bottom:4px;">✉️</div>
          <div style="color:#e6edf3;font-weight:600;font-size:0.9rem;">Outreach Email</div>
          <div style="color:#6e7681;font-size:0.8rem;margin-top:2px;">Ready-to-send template</div>
        </div>
      </div>
    </div>
    """, unsafe_allow_html=True)
