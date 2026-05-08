"""
InvestorBot (Educational Edition) - Streamlit Application

A stock analysis and paper trading tool for educational purposes.
NOT a financial advice system. NOT a guaranteed profit system.
"""

from dotenv import load_dotenv
load_dotenv()

import streamlit as st
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd
import os

from config import APP_NAME, APP_VERSION, DISCLAIMERS, PAPER_TRADING_DEFAULTS, DEFAULT_WATCHLIST
from data_fetcher import data_fetcher
from data_providers.provider_manager import provider_manager
from screener import screen_watchlist, get_single_analysis
from analyzer import calculate_rsi, calculate_macd, calculate_bollinger_bands, calculate_sma
from risk_manager import calculate_position_size, generate_risk_checklist
from trade_guide import generate_execution_guide, format_guide_to_markdown, BROKERS
from paper_trader import PaperPortfolio
from options_analyzer import find_strategies, format_strategy_markdown, fetch_options_chain
from backtest_engine import run_backtest, run_comparison_backtest, STRATEGIES
from smart_money.congressional_tracker import CongressionalTracker, format_trade_markdown
from smart_money.insider_tracker import InsiderTracker
from smart_money.institutional_tracker import InstitutionalTracker
from smart_money.mimic_engine import calculate_mimic, format_mimic_markdown
from compound_engine import CompoundEngine, EXTRACTION_THRESHOLD, EXTRACTION_AMOUNT, TAKE_PROFIT_PCT, STOP_LOSS_PCT
from signal_scorer import scan_watchlist, score_ticker
from trade_executor import AlpacaExecutor

# Page config
st.set_page_config(
    page_title=f"{APP_NAME} v{APP_VERSION}",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if "portfolio" not in st.session_state:
    st.session_state.portfolio = PaperPortfolio()
if "compounder" not in st.session_state:
    st.session_state.compounder = CompoundEngine()
if "scan_results" not in st.session_state:
    st.session_state.scan_results = []

# --- SIDEBAR ---
st.sidebar.title("📈 InvestorBot")
st.sidebar.caption(f"Educational Edition v{APP_VERSION}")
st.sidebar.markdown("---")

# Data provider status
st.sidebar.markdown("### 📡 Data Provider")
configured = provider_manager.list_configured_providers()
active = provider_manager.active_name
st.sidebar.info(f"Active: **{active.upper()}**\nConfigured: {', '.join(configured) if configured else 'Yahoo only'}")

if active == "yahoo":
    st.sidebar.warning("Using delayed Yahoo data (15-20 min). Add API keys for real-time.")
    with st.sidebar.expander("How to add real-time data"):
        st.markdown("""
        Set environment variables before running:
        ```bash
        set ALPACA_API_KEY=your_key
        set ALPACA_SECRET_KEY=your_secret
        set POLYGON_API_KEY=your_key
        set FINNHUB_API_KEY=your_key
        ```
        Or edit `data_providers/` files directly.
        """)

st.sidebar.markdown("---")

# Navigation
page = st.sidebar.radio(
    "Navigate",
    [
        "🏠 Home / Disclaimers",
        "🔍 Screener",
        "📊 Analyze Ticker",
        "⚡ Options Strategies",
        "🧪 Backtest Lab",
        "📋 Trade Guide",
        "🎮 Paper Trading",
        "🧠 Smart Money Intel",
        "🚀 Compounder",
        "📚 Education"
    ]
)

st.sidebar.markdown("---")
st.sidebar.markdown("### ⚠️ Data Notice")
st.sidebar.info("Market data is delayed 15-20 minutes via free Yahoo Finance API unless you configure a premium provider (Alpaca, Polygon, Finnhub).")

st.sidebar.markdown("---")
st.sidebar.markdown("### 💡 Tip")
st.sidebar.info("Start with Paper Trading and Backtest Lab to practice without risking real money.")


# --- HOME PAGE ---
if page == "🏠 Home / Disclaimers":
    st.title("Welcome to InvestorBot (Educational Edition)")
    
    st.error(DISCLAIMERS["general"])
    st.warning(DISCLAIMERS["risk_warning"])
    st.info(DISCLAIMERS["execution"])
    
    st.markdown("---")
    st.markdown("## What This Tool Does")
    st.markdown("""
    1. **Screens** for stocks under $20 so you can start small.
    2. **Analyzes** price trends using technical indicators (RSI, MACD, Moving Averages, Bollinger Bands).
    3. **Finds Options Strategies** with defined risk (Long Calls, Long Puts, Debit Spreads, Cash-Secured Puts).
    4. **Backtests** strategies against years of historical data to see how they would have performed.
    5. **Calculates** position sizes so you don't risk too much on one trade.
    6. **Guides** you through the exact clicks and taps to execute a trade on 15+ popular brokers.
    7. **Simulates** trading with fake money (paper trading) so you can practice.
    
    ## What This Tool Does NOT Do
    - ❌ Predict the future
    - ❌ Guarantee profits
    - ❌ Make trades for you
    - ❌ Replace a licensed financial advisor
    - ❌ Eliminate risk (you CAN lose money)
    
    ## How to Use It
    1. Read all disclaimers above.
    2. Go to **🧪 Backtest Lab** to see how strategies performed historically.
    3. Go to **🎮 Paper Trading** and practice with $1,000 fake dollars.
    4. Use the **🔍 Screener** to find low-priced stocks to research.
    5. Go to **📊 Analyze Ticker** to see charts and indicators.
    6. Check **⚡ Options Strategies** for defined-risk options plays.
    7. Use the **📋 Trade Guide** to learn the exact steps to place an order.
    8. Only trade real money when you fully understand the risks.
    """)
    
    st.markdown("---")
    st.caption("Built for educational purposes. Not financial advice.")


# --- SCREENER PAGE ---
elif page == "🔍 Screener":
    st.title("🔍 Stock Screener: Sub-$20 Opportunities")
    st.warning("This screen shows stocks under $20 with decent volume. It does NOT recommend buying them. Always do your own research.")
    
    col1, col2 = st.columns(2)
    with col1:
        max_price = st.slider("Max Price ($)", 1.0, 50.0, 20.0, 1.0)
    with col2:
        min_volume = st.selectbox("Min Avg Volume", [100_000, 500_000, 1_000_000, 5_000_000], index=1)
    
    if st.button("🚀 Run Screener", type="primary"):
        progress_bar = st.progress(0)
        status_text = st.empty()
        def _screener_progress(current, total, ticker):
            progress_bar.progress(min(current / total, 0.99))
            status_text.text(f"Screening {ticker}... ({current}/{total})")
        results = screen_watchlist(max_price=max_price, min_volume=min_volume, progress_callback=_screener_progress)
        progress_bar.empty()
        status_text.empty()
        
        if not results:
            st.info("No stocks matched your criteria from the default watchlist. Try adjusting filters or analyze a specific ticker.")
        else:
            st.success(f"Found {len(results)} stocks matching criteria.")
            
            for r in results:
                with st.expander(f"**{r['ticker']}** - {r['name']} @ ${r['price']:.2f}"):
                    c1, c2, c3, c4 = st.columns(4)
                    c1.metric("Price", f"${r['price']:.2f}")
                    c2.metric("Volume", f"{r['volume']:,}")
                    c3.metric("Trend", r['trend'])
                    c4.metric("Risk", r['risk_level'])
                    
                    st.markdown(f"**Sector:** {r['sector']}")
                    st.markdown(f"**RSI:** {r['rsi']}")
                    st.markdown(f"**Analysis:** {r['analysis'].signal_summary}")
                    
                    if st.button(f"Analyze {r['ticker']} in Detail", key=f"btn_{r['ticker']}"):
                        st.session_state["selected_ticker"] = r['ticker']
                        st.rerun()


# --- ANALYZE TICKER PAGE ---
elif page == "📊 Analyze Ticker":
    st.title("📊 Technical Analysis")
    st.warning("Technical indicators show historical patterns, not future guarantees.")
    
    ticker_input = st.text_input(
        "Enter Stock Ticker (e.g., F, T, INTC, SNAP)",
        value=st.session_state.get("selected_ticker", "F"),
        max_chars=10
    ).upper().strip()
    
    if ticker_input:
        with st.spinner(f"Analyzing {ticker_input}..."):
            result = get_single_analysis(ticker_input)
        
        if "error" in result:
            st.error(result["error"])
        else:
            analysis = result["analysis"]
            df = result["history"]
            
            # Header metrics
            st.markdown(f"## {result['name']} ({result['ticker']})")
            st.markdown(f"**Sector:** {result['sector']} | **Industry:** {result['industry']}")
            
            # Try to get real-time quote if available
            quote = provider_manager.get_quote(ticker_input)
            if quote and quote.source != "yahoo":
                st.success(f"📡 Real-time quote from {quote.source.upper()}: Bid ${quote.bid:.2f} / Ask ${quote.ask:.2f} | Last ${quote.last_price:.2f}")
            
            m1, m2, m3, m4, m5 = st.columns(5)
            m1.metric("Price", f"${result['price']:.2f}")
            m2.metric("Trend", analysis.trend)
            m3.metric("RSI", analysis.rsi)
            m4.metric("Risk Level", analysis.risk_level)
            m5.metric("20-day SMA", analysis.sma_20)
            
            st.markdown(f"**Signal Summary:** {analysis.signal_summary}")
            
            # Charts
            if df is not None and not df.empty:
                st.markdown("---")
                st.markdown("### Price Chart with Indicators")
                
                fig = make_subplots(
                    rows=3, cols=1,
                    shared_xaxes=True,
                    vertical_spacing=0.05,
                    row_heights=[0.6, 0.2, 0.2],
                    subplot_titles=("Price & Bollinger Bands", "RSI", "MACD")
                )
                
                # Price & Bollinger
                fig.add_trace(go.Scatter(x=df.index, y=df['close'], name="Close", line=dict(color='blue')), row=1, col=1)
                bb_up, bb_mid, bb_low = calculate_bollinger_bands(df['close'])
                if analysis.bb_upper and analysis.bb_middle and analysis.bb_lower:
                    fig.add_trace(go.Scatter(x=df.index, y=bb_up, name="BB Upper", line=dict(color='rgba(255,0,0,0.3)')), row=1, col=1)
                    fig.add_trace(go.Scatter(x=df.index, y=bb_low, name="BB Lower", line=dict(color='rgba(0,255,0,0.3)')), row=1, col=1)
                    fig.add_trace(go.Scatter(x=df.index, y=bb_mid, name="BB Middle", line=dict(color='rgba(128,128,128,0.5)', dash='dash')), row=1, col=1)
                
                fig.add_trace(go.Scatter(x=df.index, y=calculate_sma(df['close'], 20), name="SMA 20", line=dict(color='orange')), row=1, col=1)
                fig.add_trace(go.Scatter(x=df.index, y=calculate_sma(df['close'], 50), name="SMA 50", line=dict(color='purple')), row=1, col=1)
                
                # RSI
                rsi_vals = calculate_rsi(df['close'])
                fig.add_trace(go.Scatter(x=df.index, y=rsi_vals, name="RSI", line=dict(color='teal')), row=2, col=1)
                fig.add_hline(y=70, line_dash="dash", line_color="red", row=2, col=1)
                fig.add_hline(y=30, line_dash="dash", line_color="green", row=2, col=1)
                
                # MACD
                macd_line, signal_line, hist = calculate_macd(df['close'])
                fig.add_trace(go.Scatter(x=df.index, y=macd_line, name="MACD", line=dict(color='blue')), row=3, col=1)
                fig.add_trace(go.Scatter(x=df.index, y=signal_line, name="Signal", line=dict(color='red')), row=3, col=1)
                colors = ['green' if h >= 0 else 'red' for h in hist]
                fig.add_trace(go.Bar(x=df.index, y=hist, name="Histogram", marker_color=colors), row=3, col=1)
                
                fig.update_layout(height=700, showlegend=True, xaxis_rangeslider_visible=False)
                st.plotly_chart(fig, use_container_width=True)
            
            # Risk Calculator
            st.markdown("---")
            st.markdown("### 🛡️ Position Size & Risk Calculator")
            st.info("Adjust your account size and risk tolerance below. This tool helps you avoid putting too much money in one trade.")
            
            acc_col, risk_col, stop_col = st.columns(3)
            with acc_col:
                account_balance = st.number_input("Account Balance ($)", min_value=0.0, value=1000.0, step=100.0)
            with risk_col:
                risk_pct = st.slider("Max Risk per Trade (%)", 0.5, 10.0, 2.0, 0.5) / 100
            with stop_col:
                stop_pct = st.slider("Stop Loss below entry (%)", 1.0, 20.0, 5.0, 1.0) / 100
            
            position = calculate_position_size(
                ticker=result['ticker'],
                current_price=result['price'],
                account_balance=account_balance,
                max_risk_per_trade_pct=risk_pct,
                stop_loss_pct=stop_pct
            )
            
            pc1, pc2, pc3, pc4 = st.columns(4)
            pc1.metric("Suggested Shares", position.suggested_shares)
            pc2.metric("Total Cost", f"${position.total_cost:.2f}")
            pc3.metric("Stop Loss", f"${position.stop_loss_price:.2f}")
            pc4.metric("Max Loss", f"${position.max_loss_amount:.2f}")
            
            st.markdown(f"**Notes:** {position.notes}")
            
            # Risk Checklist
            st.markdown("#### Pre-Trade Risk Checklist")
            checklist = generate_risk_checklist(position)
            for item, status in checklist.items():
                if status is True:
                    st.checkbox(item, value=True, disabled=True)
                elif status is False:
                    st.checkbox(f"❌ {item} - DOES NOT PASS", value=False, disabled=True)
                else:
                    st.checkbox(item, key=f"check_{item}_{ticker_input}")
            
            # Paper trade buttons
            st.markdown("---")
            st.markdown("### 🎮 Practice This Trade")
            pt_col1, pt_col2 = st.columns(2)
            with pt_col1:
                if st.button("📥 Paper Buy (Practice)", type="secondary"):
                    buy_result = st.session_state.portfolio.buy(
                        ticker=result['ticker'],
                        shares=position.suggested_shares,
                        price=result['price'],
                        notes=f"Analysis: {analysis.trend}, RSI: {analysis.rsi}"
                    )
                    if buy_result["success"]:
                        st.success(f"Paper bought {position.suggested_shares} shares of {result['ticker']} at ${result['price']:.2f}. Remaining cash: ${buy_result['remaining_cash']:.2f}")
                    else:
                        st.error(buy_result["error"])
            with pt_col2:
                if st.button("📤 Paper Sell (Practice)", type="secondary"):
                    sell_result = st.session_state.portfolio.sell(
                        ticker=result['ticker'],
                        shares=position.suggested_shares,
                        price=result['price']
                    )
                    if sell_result["success"]:
                        st.success(f"Paper sold {position.suggested_shares} shares of {result['ticker']} at ${result['price']:.2f}. P&L: ${sell_result['pnl']:.2f}")
                    else:
                        st.error(sell_result["error"])


# --- OPTIONS STRATEGIES PAGE ---
elif page == "⚡ Options Strategies":
    st.title("⚡ Options Strategies (Defined Risk)")
    st.error("""
    **⚠️ OPTIONS RISK WARNING**: Options are complex instruments. You can lose your entire premium.
    "Defined risk" means you know the maximum loss in advance, but you CAN still lose 100% of what you put in.
    Most brokers require approval to trade options. This is educational only.
    """)
    
    opt_ticker = st.text_input("Enter Stock Ticker for Options Analysis", "F").upper().strip()
    max_capital = st.slider("Max Capital per Strategy ($)", 5, 500, 50, 5)
    
    if st.button("🔍 Find Strategies", type="primary"):
        with st.spinner(f"Scanning options chains for {opt_ticker}..."):
            strategies = find_strategies(opt_ticker, max_capital=max_capital)
        
        if not strategies:
            st.warning(f"No suitable options strategies found for {opt_ticker} under ${max_capital}. The stock may not have options, or premiums may be too high.")
        else:
            st.success(f"Found {len(strategies)} potential strategies.")
            
            for s in strategies:
                with st.expander(f"{s.name} | Capital: ${s.capital_required:.0f} | Max Loss: ${s.max_loss:.0f}"):
                    st.markdown(format_strategy_markdown(s))
                    
                    # Broker guide for this specific options trade
                    st.markdown("#### How to Execute This Options Trade")
                    st.info("Below is a general guide. Options interfaces vary significantly by broker. Look for 'Options Chain' or 'Spreads' in your broker app.")
                    st.markdown(f"""
                    1. **Open your broker app** and search for **{s.ticker}**.
                    2. **Go to the Options Chain** (usually a tab called 'Options' or 'Trade Options').
                    3. **Select expiration:** {s.legs[0].expiration if s.legs else 'See description above'}.
                    4. **For a {s.name}:**
                    """)
                    
                    for leg in s.legs:
                        action_text = "Buy to Open" if leg.action == "BUY" else "Sell to Open"
                        st.markdown(f"   - **{action_text}** the **{leg.side}** at strike **${leg.strike:.2f}**")
                        st.markdown(f"   - Premium: ~${leg.premium:.2f} (bid ${leg.bid:.2f} / ask ${leg.ask:.2f})")
                    
                    st.markdown("""
                    5. **Review the max loss and max profit** shown by your broker before submitting.
                    6. **Submit as a single complex order** (if a multi-leg spread) to ensure proper pricing.
                    7. **Set a closing order** at your profit target (e.g., 50% of max profit) to avoid holding to expiration.
                    """)
                    
                    st.caption("Note: Options require Level 2 (spreads) or Level 1 (buy calls/puts) approval. Approval process can take 1-3 business days.")


# --- BACKTEST LAB PAGE ---
elif page == "🧪 Backtest Lab":
    st.title("🧪 Strategy Backtest Lab")
    st.warning("""
    **PAST PERFORMANCE DOES NOT GUARANTEE FUTURE RESULTS.**
    These backtests show what WOULD have happened historically. Markets change.
    Use this to learn how indicators behave, not to predict tomorrow.
    """)
    
    bt_ticker = st.text_input("Ticker to Backtest", "F").upper().strip()
    
    c1, c2, c3 = st.columns(3)
    with c1:
        strategy_pick = st.selectbox("Strategy", list(STRATEGIES.keys()))
    with c2:
        bt_period = st.selectbox("Historical Period", ["1y", "2y", "3y", "5y"], index=1)
    with c3:
        bt_capital = st.number_input("Starting Capital", min_value=100.0, value=1000.0, step=100.0)
    
    c4, c5, c6 = st.columns(3)
    with c4:
        pos_size = st.slider("Position Size (% of capital)", 5, 50, 20, 5) / 100
    with c5:
        use_trailing = st.checkbox("Use Trailing Stop", value=True, help="Trailing stop ratchets upward as price rises, locking in gains. Better for trending stocks.")
        if use_trailing:
            trail_pct = st.slider("Trailing Stop (%)", 3, 20, 8, 1) / 100
            sl_pct = 0.0
        else:
            sl_pct = st.slider("Fixed Stop Loss (%)", 1, 15, 5, 1) / 100
            trail_pct = 0.0
    with c6:
        commission = st.number_input("Commission per Trade ($)", min_value=0.0, max_value=20.0, value=0.0, step=0.5)

    if st.button("▶️ Run Backtest", type="primary"):
        with st.spinner("Running historical simulation..."):
            result = run_backtest(
                ticker=bt_ticker,
                strategy_name=strategy_pick,
                initial_capital=bt_capital,
                position_size_pct=pos_size,
                stop_loss_pct=sl_pct,
                trailing_stop_pct=trail_pct,
                period=bt_period,
                commission_per_trade=commission
            )
        
        if result is None:
            st.error(f"Could not run backtest for {bt_ticker}. Insufficient historical data or invalid ticker.")
        else:
            st.success(f"Backtest complete for {bt_ticker} using '{strategy_pick}'")
            
            # Metrics
            m1, m2, m3, m4, m5 = st.columns(5)
            m1.metric("Total Return", f"{result.total_return_pct:.1f}%")
            m2.metric("Win Rate", f"{result.win_rate:.0f}%")
            m3.metric("Profit Factor", f"{result.profit_factor:.2f}")
            m4.metric("Max Drawdown", f"{result.max_drawdown_pct:.1f}%")
            m5.metric("Sharpe Ratio", f"{result.sharpe_ratio:.2f}")
            
            st.markdown(f"**Period:** {result.start_date[:10]} to {result.end_date[:10]}")
            st.markdown(f"**Trades:** {result.total_trades} ({result.winning_trades} wins, {result.losing_trades} losses)")
            st.markdown(f"**Final Capital:** ${result.final_capital:,.2f} (from ${result.initial_capital:,.2f})")
            
            # Equity curve chart
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=result.equity_curve.index,
                y=result.equity_curve['equity'],
                mode='lines',
                name='Portfolio Value',
                line=dict(color='green')
            ))
            fig.add_hline(y=result.initial_capital, line_dash="dash", line_color="gray", annotation_text="Start")
            fig.update_layout(
                title="Equity Curve",
                xaxis_title="Date",
                yaxis_title="Portfolio Value ($)",
                height=400
            )
            st.plotly_chart(fig, use_container_width=True)
            
            # Trade log
            if result.trades:
                st.markdown("### Trade Log")
                trade_data = []
                for t in result.trades:
                    trade_data.append({
                        "Entry": str(t.entry_date)[:10],
                        "Exit": str(t.exit_date)[:10] if t.exit_date else "",
                        "Entry $": f"${t.entry_price:.2f}",
                        "Exit $": f"${t.exit_price:.2f}" if t.exit_price else "",
                        "Shares": t.shares,
                        "P&L": f"${t.pnl:.2f}",
                        "Return": f"{t.pnl_pct:.1f}%",
                        "Reason": t.exit_reason
                    })
                st.dataframe(pd.DataFrame(trade_data), use_container_width=True)
    
    st.markdown("---")
    st.markdown("### 📊 Strategy Comparison")
    st.info("Compare all strategies at once on the same ticker and period.")
    
    if st.button("Compare All Strategies"):
        with st.spinner("Running all strategies..."):
            comparison = run_comparison_backtest(bt_ticker, list(STRATEGIES.keys()), bt_capital, bt_period)
        
        if not comparison:
            st.error("Could not run comparison.")
        else:
            comp_data = []
            for name, res in comparison.items():
                comp_data.append({
                    "Strategy": name,
                    "Return %": res.total_return_pct,
                    "Win Rate %": res.win_rate,
                    "Profit Factor": res.profit_factor,
                    "Max DD %": res.max_drawdown_pct,
                    "Sharpe": res.sharpe_ratio,
                    "Trades": res.total_trades
                })
            comp_df = pd.DataFrame(comp_data)
            st.dataframe(comp_df, use_container_width=True)
            
            # Comparison chart
            fig = go.Figure()
            for name, res in comparison.items():
                fig.add_trace(go.Scatter(
                    x=res.equity_curve.index,
                    y=res.equity_curve['equity'],
                    mode='lines',
                    name=name
                ))
            fig.update_layout(
                title="Strategy Comparison: Equity Curves",
                xaxis_title="Date",
                yaxis_title="Portfolio Value ($)",
                height=500
            )
            st.plotly_chart(fig, use_container_width=True)


# --- TRADE GUIDE PAGE ---
elif page == "📋 Trade Guide":
    st.title("📋 Step-by-Step Trade Execution Guide")
    st.warning("These are general instructions. Your broker's interface may differ slightly. Always verify before submitting.")
    
    guide_ticker = st.text_input("Ticker to Trade", "F").upper().strip()
    guide_broker = st.selectbox("Select Your Broker", list(BROKERS.keys()), format_func=lambda x: BROKERS[x])
    guide_action = st.radio("Action", ["BUY", "SELL"], horizontal=True)
    guide_order = st.selectbox("Order Type", ["Limit", "Market", "Stop-Loss"])
    
    if guide_ticker:
        price = data_fetcher.get_current_price(guide_ticker) or 0
        position = calculate_position_size(
            ticker=guide_ticker,
            current_price=price,
            account_balance=st.session_state.portfolio.cash,
            max_risk_per_trade_pct=0.02,
            stop_loss_pct=0.05
        )
        
        st.markdown(f"**Current Price (delayed):** ${price:.2f}")
        st.markdown(f"**Suggested Shares (based on default risk):** {position.suggested_shares}")
        
        steps = generate_execution_guide(guide_broker, guide_ticker, guide_action, position, guide_order)
        
        st.markdown("---")
        for step in steps:
            with st.container():
                st.markdown(f"### Step {step.step_number}: {step.title}")
                for inst in step.instructions:
                    st.markdown(f"- {inst}")
                if step.caution:
                    st.warning(f"⚠️ {step.caution}")
                st.markdown("---")


# --- PAPER TRADING PAGE ---
elif page == "🎮 Paper Trading":
    st.title("🎮 Paper Trading Simulator")
    st.success("Practice trading with fake money! No real money is at risk here.")
    
    portfolio = st.session_state.portfolio
    summary = portfolio.get_summary()
    
    # Portfolio Summary
    st.markdown("### Portfolio Summary")
    s1, s2, s3, s4 = st.columns(4)
    s1.metric("Cash", f"${summary['cash']:.2f}")
    s2.metric("Market Value", f"${summary['total_market_value']:.2f}")
    s3.metric("Total Value", f"${summary['total_value']:.2f}")
    s4.metric("Total Return", f"{summary['total_return_pct']:.2f}%")
    
    st.markdown("---")
    
    # Open Positions
    st.markdown("### Open Positions")
    if summary['positions']:
        pos_df = pd.DataFrame(summary['positions'])
        st.dataframe(pos_df, use_container_width=True)
    else:
        st.info("No open positions. Go to 'Analyze Ticker' to practice buying.")
    
    st.markdown("---")
    
    # Manual Trade
    st.markdown("### Place a Manual Paper Trade")
    mt1, mt2, mt3 = st.columns(3)
    with mt1:
        manual_ticker = st.text_input("Ticker", "F").upper().strip()
    with mt2:
        manual_shares = st.number_input("Shares", min_value=1, value=10, step=1)
    with mt3:
        manual_price = st.number_input("Price per Share ($)", min_value=0.01, value=10.0, step=0.01)
    
    mt_col1, mt_col2 = st.columns(2)
    with mt_col1:
        if st.button("📥 Paper Buy", type="primary"):
            res = portfolio.buy(manual_ticker, manual_shares, manual_price)
            if res["success"]:
                st.success(f"Bought {manual_shares} shares of {manual_ticker} at ${manual_price:.2f}")
                st.rerun()
            else:
                st.error(res["error"])
    with mt_col2:
        if st.button("📤 Paper Sell", type="primary"):
            res = portfolio.sell(manual_ticker, manual_shares, manual_price)
            if res["success"]:
                st.success(f"Sold {manual_shares} shares of {manual_ticker} at ${manual_price:.2f}. P&L: ${res['pnl']:.2f}")
                st.rerun()
            else:
                st.error(res["error"])
    
    st.markdown("---")
    if st.button("🗑️ Reset Portfolio to $1,000", type="secondary"):
        portfolio.reset(1000.0)
        st.rerun()


# --- SMART MONEY INTEL PAGE ---
elif page == "🧠 Smart Money Intel":
    st.title("🧠 Smart Money Intelligence")
    st.error("""
    **⚠️ LEGAL NOTICE**: All data shown here comes from **public government filings** (SEC Form 4, 13F, Congressional STOCK Act disclosures).
    
    **No private accounts were accessed.** This is the same data apps like "Capitol Trades," "Quiver Quant," and "Autopilot" use.
    
    **Copying anyone's trades does not guarantee profits.** These are delayed disclosures (up to 45 days for Congress, 2 days for insiders, 45 days for 13F).
    By the time you see them, prices may have already moved.
    """)
    
    intel_tab1, intel_tab2, intel_tab3 = st.tabs([
        "🏛️ Congressional Trading",
        "👔 Insider Trading",
        "🏢 Institutional Holdings"
    ])
    
    # --- CONGRESSIONAL TAB ---
    with intel_tab1:
        st.markdown("### Track What Congress Buys & Sells")
        st.info("Members of Congress must disclose stock trades within 45 days under the STOCK Act. This tab shows those public disclosures.")
        
        ct = CongressionalTracker()
        
        c1, c2 = st.columns(2)
        with c1:
            congress_days = st.slider("Days to look back", 30, 365, 90, 15)
        with c2:
            congress_chamber = st.selectbox("Chamber", ["Both", "House", "Senate"])
        
        chamber_filter = None if congress_chamber == "Both" else congress_chamber.lower()
        
        if st.button("🔍 Fetch Congressional Trades", type="primary"):
            with st.spinner("Loading public disclosure data..."):
                trades = ct.fetch_recent_trades(days=congress_days, chamber=chamber_filter)
            
            if not trades:
                st.warning("No congressional trade disclosures found in this period. Try extending the date range.")
            else:
                st.success(f"Found {len(trades)} publicly disclosed trades.")
                
                # Summary stats
                buys = ct.get_buy_signals(trades)
                sells = ct.get_sell_signals(trades)
                st.markdown(f"**{len(buys)}** purchases | **{len(sells)}** sales")
                
                # Top traders
                st.markdown("#### Most Active Traders in Congress")
                top_traders = ct.get_top_traders(trades, min_trades=2)
                if not top_traders.empty:
                    st.dataframe(top_traders, use_container_width=True)
                
                # Most traded tickers
                st.markdown("#### Most Mentioned Tickers")
                top_tickers = ct.get_most_traded_tickers(trades)
                if not top_tickers.empty:
                    st.dataframe(top_tickers.head(15), use_container_width=True)
                
                # Individual trades with mimic
                st.markdown("#### Recent Disclosed Trades")
                for trade in trades[:30]:
                    with st.expander(f"{trade.politician} — {trade.transaction_type} {trade.ticker} ({trade.asset_name})"):
                        st.markdown(format_trade_markdown(trade))
                        
                        # Mimic calculator
                        st.markdown("#### 💰 What if you copied this trade?")
                        mimic_investment = st.number_input(
                            f"Investment amount ($)",
                            min_value=10, value=1000, step=100,
                            key=f"mimic_congress_{trade.politician}_{trade.ticker}_{trade.transaction_date}"
                        )
                        if st.button("Calculate Copy Results", key=f"btn_mimic_congress_{trade.ticker}_{trade.transaction_date}"):
                            with st.spinner("Calculating historical performance..."):
                                mimic = calculate_mimic(
                                    ticker=trade.ticker,
                                    trade_date=trade.transaction_date,
                                    copied_from=trade.politician,
                                    investment_dollars=mimic_investment,
                                    transaction_type="buy" if "purchase" in trade.transaction_type.lower() else "sell"
                                )
                            if mimic:
                                st.markdown(format_mimic_markdown(mimic))
                            else:
                                st.error("Could not calculate mimic. Insufficient historical data or ticker may be invalid.")
    
    # --- INSIDER TAB ---
    with intel_tab2:
        st.markdown("### Track Corporate Insider Trading (SEC Form 4)")
        st.info("Corporate officers and board members must report buying/selling their own company's stock within 2 business days.")
        
        it = InsiderTracker()
        
        insider_ticker = st.text_input("Enter Ticker for Insider Analysis", "AAPL").upper().strip()
        
        if st.button("🔍 Fetch Insider Data", type="primary"):
            with st.spinner("Loading SEC Form 4 filings..."):
                insider_trades = it.fetch_insider_transactions(insider_ticker)
                sentiment = it.fetch_insider_sentiment(insider_ticker)
            
            if sentiment:
                s1, s2, s3 = st.columns(3)
                s1.metric("Insider Sentiment", sentiment["sentiment"])
                s2.metric("Net MSPR", f"{sentiment['net_mspr']:.2f}")
                s3.metric("Months Analyzed", sentiment["months_analyzed"])
            
            if not insider_trades:
                st.warning(f"No insider transactions found for {insider_ticker} via available data sources.")
                st.info("Note: Insider data requires a Finnhub API key (FINNHUB_API_KEY). Without it, this feature is limited.")
            else:
                summary = it.get_summary(insider_trades)
                st.success(f"Found {summary['total_trades']} insider transactions")
                
                m1, m2, m3, m4 = st.columns(4)
                m1.metric("Buy Value", f"${summary['total_buy_value']:,.0f}")
                m2.metric("Sell Value", f"${summary['total_sell_value']:,.0f}")
                m3.metric("Net", f"${summary['net_value']:,.0f}")
                m4.metric("Signal", summary['signal'])
                
                # Show recent trades
                st.markdown("#### Recent Insider Transactions")
                for t in insider_trades[:20]:
                    action_emoji = "🟢" if t.shares > 0 else "🔴"
                    with st.expander(f"{action_emoji} {t.insider_name} ({t.insider_title}) — {abs(t.shares):,} shares @ ${t.price_per_share:.2f}"):
                        st.markdown(f"""
                        - **Company:** {t.company}
                        - **Date:** {t.transaction_date}
                        - **Type:** {t.transaction_type}
                        - **Shares:** {t.shares:,}
                        - **Price:** ${t.price_per_share:.2f}
                        - **Total Value:** ${t.total_value:,.2f}
                        - **Shares Owned After:** {t.shares_owned_after:,}
                        """)
    
    # --- INSTITUTIONAL TAB ---
    with intel_tab3:
        st.markdown("### Track Institutional Holdings (SEC 13F)")
        st.info("Institutions with $100M+ AUM must file quarterly holdings reports. These show what hedge funds and banks own.")
        
        inst = InstitutionalTracker()
        
        inst_ticker = st.text_input("Enter Ticker for Institutional Analysis", "AAPL").upper().strip()
        
        st.markdown("#### 🏆 Famous Managers to Research")
        st.info("Search these managers on SEC EDGAR or QuiverQuant to see their full portfolios. Data is delayed by ~45 days.")
        
        manager_df = pd.DataFrame([
            {"Manager": name, "CIK": cik}
            for cik, name in inst.FAMOUS_MANAGERS.items()
        ])
        st.dataframe(manager_df, use_container_width=True, hide_index=True)
        
        if st.button("🔍 Fetch Institutional Ownership", type="primary"):
            with st.spinner("Loading institutional data..."):
                ownership = inst.fetch_ownership(inst_ticker)
                funds = inst.fetch_fund_ownership(inst_ticker)
            
            if not ownership and not funds:
                st.warning(f"No institutional ownership data found for {inst_ticker}.")
                st.info("This data requires a Finnhub API key (FINNHUB_API_KEY). Set it as an environment variable.")
            else:
                if ownership:
                    summary = inst.summarize_ownership(ownership)
                    st.success(f"{summary['total_institutions']} institutions hold {inst_ticker}")
                    st.metric("Total Shares Held", f"{summary['total_shares_held']:,}")
                    
                    st.markdown("#### Top Holders")
                    st.dataframe(pd.DataFrame(summary['top_holders']), use_container_width=True)
                    
                    if summary.get('top_buyers'):
                        st.markdown("#### Recent Buyers")
                        st.dataframe(pd.DataFrame(summary['top_buyers']), use_container_width=True)
                    
                    if summary.get('top_sellers'):
                        st.markdown("#### Recent Sellers")
                        st.dataframe(pd.DataFrame(summary['top_sellers']), use_container_width=True)
                
                if funds:
                    st.markdown("#### Top Mutual Fund Holders")
                    st.dataframe(pd.DataFrame(funds), use_container_width=True)
    
    st.markdown("---")
    st.caption("Data sources: Capitol Trades API, SEC EDGAR (Form 4, 13F), Finnhub. All data is public and delayed.")

# --- COMPOUNDER PAGE ---
elif page == "🚀 Compounder":
    st.title("🚀 Compound Growth Engine")
    st.error("""
    **⚠️ REAL MONEY WARNING**: This page can place actual trades through Alpaca.
    Always start in PAPER mode and verify the system is performing before switching to live.
    No strategy guarantees profits. You can lose your entire balance.
    """)

    engine = st.session_state.compounder
    executor = AlpacaExecutor(paper=engine.state.is_paper)

    # --- Mode & Controls ---
    ctrl1, ctrl2, ctrl3 = st.columns(3)
    with ctrl1:
        mode_label = "🟡 PAPER MODE" if engine.state.is_paper else "🔴 LIVE MODE"
        st.markdown(f"### {mode_label}")
        if engine.state.is_paper:
            if st.button("Switch to LIVE (real money)", type="secondary"):
                st.warning("Are you sure? This will trade real money. Click again to confirm.")
                if st.button("CONFIRM — switch to live", type="primary"):
                    engine.set_paper_mode(False)
                    st.rerun()
        else:
            if st.button("Switch to PAPER (safe)", type="secondary"):
                engine.set_paper_mode(True)
                st.rerun()

    with ctrl2:
        new_bal = st.number_input("Override Balance ($)", min_value=1.0, value=engine.state.balance, step=1.0)
        if st.button("Set Balance"):
            engine.set_balance(new_bal)
            st.rerun()

    with ctrl3:
        if st.button("🔄 Reset Compounder", type="secondary"):
            reset_start = st.number_input("Starting balance ($)", min_value=1.0, value=20.0, step=1.0)
            if st.button("Confirm Reset"):
                engine.reset(starting_balance=reset_start, paper=True)
                st.session_state.scan_results = []
                st.rerun()

    st.markdown("---")

    # --- Alpaca Account Status ---
    st.markdown("### 📡 Alpaca Account")
    if not executor.is_configured:
        st.warning("Alpaca API keys not set. Add `ALPACA_API_KEY` and `ALPACA_SECRET_KEY` to use live/paper execution.")
        st.info("Without Alpaca keys, you can still run the scanner and manually execute trades in your broker app.")
    else:
        account = executor.get_account()
        if account:
            a1, a2, a3, a4 = st.columns(4)
            a1.metric("Portfolio Value", f"${account.portfolio_value:,.2f}")
            a2.metric("Buying Power", f"${account.buying_power:,.2f}")
            a3.metric("Day Trades Used", account.daytrade_count)
            a4.metric("Market Open", "✅ Yes" if executor.is_market_open() else "⛔ Closed")
            if account.pattern_day_trader:
                st.warning("⚠️ Account flagged as Pattern Day Trader ($25k minimum required for day trading).")
            if account.trading_blocked or account.account_blocked:
                st.error("❌ Trading is currently blocked on this account. Check Alpaca dashboard.")
        else:
            st.error("Could not connect to Alpaca. Check your API keys and network.")

    st.markdown("---")

    # --- Compound Progress Dashboard ---
    st.markdown("### 📈 Compound Ladder Progress")

    bal = engine.state.balance
    target = engine.get_next_target()
    progress = engine.get_progress_pct() / 100

    p1, p2, p3, p4, p5 = st.columns(5)
    p1.metric("Current Balance", f"${bal:.2f}")
    p2.metric("Next Target", f"${target:.0f}")
    p3.metric("Total Extracted", f"${engine.state.total_extracted:.2f}")
    p4.metric("Win Rate", f"{engine.win_rate:.0f}%" if engine.state.trade_count > 0 else "—")
    p5.metric("Total Return", f"{engine.total_return_pct:.1f}%")

    st.progress(progress, text=f"Progress to ${target:.0f}: {progress*100:.1f}%")

    # Tier ladder visualization
    st.markdown("#### Doubling Ladder")
    ladder_cols = st.columns(7)
    tier_values = [20, 40, 80, 160, 320, 640, 1000]
    for i, (col, tier) in enumerate(zip(ladder_cols, tier_values)):
        if bal >= tier:
            col.success(f"✅ ${tier}")
        elif bal >= tier * 0.5:
            col.warning(f"🔄 ${tier}")
        else:
            col.info(f"⬜ ${tier}")

    if engine.state.extractions:
        st.markdown("#### 💰 Extraction History")
        ext_data = [{
            "Date": e["date"][:10],
            "Extracted": f"${e['amount']:.2f}",
            "Balance After": f"${e['balance_after']:.2f}",
            "Cumulative": f"${e['cumulative_extracted']:.2f}"
        } for e in engine.state.extractions]
        st.dataframe(pd.DataFrame(ext_data), use_container_width=True, hide_index=True)

    st.markdown("---")

    # --- Active Trade Monitor ---
    if engine.state.active_trade:
        trade = engine.state.active_trade
        st.markdown("### 🔴 Active Trade")

        current_price = data_fetcher.get_current_price(trade["ticker"]) or trade["entry_price"]

        # Ratchet trailing stop before displaying
        trailing_stop = engine.update_trailing_stop(current_price)
        effective_stop = max(trailing_stop, trade["stop_loss"])

        st.warning(f"Open position in **{trade['ticker']}** — Entry: ${trade['entry_price']:.4f} | Target: ${trade['take_profit']:.4f} | Trailing Stop: ${effective_stop:.4f}")

        pnl_pct = ((current_price - trade["entry_price"]) / trade["entry_price"]) * 100
        pnl_dollars = (pnl_pct / 100) * trade["notional"]

        t1, t2, t3, t4, t5 = st.columns(5)
        t1.metric("Entry Price", f"${trade['entry_price']:.4f}")
        t2.metric("Current Price", f"${current_price:.4f}", f"{pnl_pct:+.2f}%")
        t3.metric("Unrealized P&L", f"${pnl_dollars:+.2f}")
        t4.metric("Trailing Stop", f"${effective_stop:.4f}")
        t5.metric("Position Size", f"${trade['notional']:.2f}")

        hit_tp = current_price >= trade["take_profit"]
        hit_sl = current_price <= effective_stop

        if hit_tp:
            st.success(f"🎯 TAKE PROFIT TARGET HIT at ${trade['take_profit']:.4f}!")
        if hit_sl:
            st.error(f"🛑 TRAILING STOP HIT at ${effective_stop:.4f}!")

        close_col1, close_col2 = st.columns(2)
        with close_col1:
            if st.button("✅ Close Position (Take Profit / Manual)", type="primary"):
                if executor.is_configured:
                    result = executor.close_position(trade["ticker"])
                    if result.success:
                        pnl, extracted = engine.record_trade_close(current_price, trade["notional"])
                        st.success(f"Position closed! P&L: ${pnl:+.2f}")
                        if extracted > 0:
                            st.balloons()
                            st.success(f"🎉 EXTRACTION TRIGGERED! ${extracted:.0f} sent to safe account. Continuing with ${engine.state.balance:.2f}.")
                        st.rerun()
                    else:
                        st.error(result.message)
                else:
                    # Manual close without Alpaca
                    manual_exit = st.number_input("Manual exit price", value=current_price, step=0.01)
                    pnl, extracted = engine.record_trade_close(manual_exit, trade["notional"])
                    st.success(f"Recorded manual close. P&L: ${pnl:+.2f}")
                    if extracted > 0:
                        st.balloons()
                        st.success(f"🎉 EXTRACTION! ${extracted:.0f} locked in. Continuing with ${engine.state.balance:.2f}.")
                    st.rerun()

        with close_col2:
            if st.button("🛑 Stop Loss (Close at Loss)", type="secondary"):
                if executor.is_configured:
                    result = executor.close_position(trade["ticker"])
                    if result.success:
                        exit_price = result.filled_price or trade["stop_loss"]
                        pnl, _ = engine.record_trade_close(exit_price, trade["notional"])
                        st.warning(f"Stopped out. P&L: ${pnl:+.2f}. Remaining balance: ${engine.state.balance:.2f}")
                        st.rerun()
                    else:
                        st.error(result.message)
                else:
                    pnl, _ = engine.record_trade_close(effective_stop, trade["notional"])
                    st.warning(f"Recorded trailing stop. P&L: ${pnl:+.2f}. Balance: ${engine.state.balance:.2f}")
                    st.rerun()

        st.markdown("---")

    # --- High Conviction Scanner ---
    st.markdown("### 🔍 High Conviction Scanner")
    st.info(f"Scans {len(DEFAULT_WATCHLIST)} tickers across 7-9 signals. Without Finnhub/Alpaca API keys, smart money signals are excluded and the 7 technical signals are scored independently. Add API keys to unlock insider and congressional data.")

    scan_col1, scan_col2, scan_col3 = st.columns(3)
    with scan_col1:
        min_score = st.slider("Minimum Score", 5, 9, 7)
    with scan_col2:
        custom_tickers_input = st.text_input("Add custom tickers (comma-separated)", "")
    with scan_col3:
        st.markdown("&nbsp;")
        run_scan = st.button("🚀 Run Scanner", type="primary", disabled=engine.state.active_trade is not None)

    if engine.state.active_trade:
        st.warning("Close the active trade before running a new scan.")

    if run_scan:
        custom_tickers = [t.strip().upper() for t in custom_tickers_input.split(",") if t.strip()]
        tickers_to_scan = list(set(DEFAULT_WATCHLIST + custom_tickers))

        progress_bar = st.progress(0)
        status_text = st.empty()

        def update_progress(i, total, ticker):
            progress_bar.progress((i + 1) / total)
            status_text.text(f"Scoring {ticker}... ({i+1}/{total})")

        with st.spinner("Scanning for high-conviction setups..."):
            results = scan_watchlist(tickers_to_scan, min_score=min_score, progress_callback=update_progress)

        progress_bar.empty()
        status_text.empty()
        st.session_state.scan_results = results

        if results:
            st.success(f"Found {len(results)} high-conviction {'setup' if len(results)==1 else 'setups'}.")
        else:
            st.warning("No tickers met the minimum score threshold right now. Markets may be unfavorable or data is delayed. Try again later or lower the minimum score.")

    # --- Display Scan Results ---
    if st.session_state.scan_results:
        st.markdown("#### Scan Results")
        for scored in st.session_state.scan_results:
            conviction_color = {"EXTREME": "🟢", "HIGH": "🟡", "MEDIUM": "🟠", "LOW": "🔴"}
            icon = conviction_color.get(scored.conviction, "⚪")

            sm_tag = "" if scored.smart_money_available else " · tech signals only"
            with st.expander(f"{icon} **{scored.ticker}** — Score {scored.score}/{scored.max_score} ({scored.conviction}) @ ${scored.price:.2f}{sm_tag}"):
                # Signal breakdown
                sig_cols = st.columns(3)
                for i, (sig_name, passed) in enumerate(scored.signals.items()):
                    col = sig_cols[i % 3]
                    detail = scored.signal_details.get(sig_name, "")
                    if passed:
                        col.success(f"✅ {sig_name}")
                    else:
                        col.error(f"❌ {sig_name}")
                    col.caption(detail)

                st.markdown("---")

                # Trade setup
                pos_size = engine.get_position_size()
                tp = engine.get_take_profit_price(scored.price)
                sl = engine.get_stop_loss_price(scored.price)
                target_gain = pos_size * TAKE_PROFIT_PCT
                max_risk = pos_size * STOP_LOSS_PCT

                ts1, ts2, ts3, ts4 = st.columns(4)
                ts1.metric("Position Size", f"${pos_size:.2f}")
                ts2.metric("Take Profit", f"${tp:.4f} (+{TAKE_PROFIT_PCT*100:.0f}%)")
                ts3.metric("Stop Loss", f"${sl:.4f} (-{STOP_LOSS_PCT*100:.0f}%)")
                ts4.metric("Target Gain", f"${target_gain:.2f} | Risk ${max_risk:.2f}")

                if engine.state.active_trade:
                    st.warning("Already have an active trade. Close it before opening a new position.")
                elif pos_size < 1.0:
                    st.error("Balance too low — minimum trade is $1.00.")
                else:
                    execute_btn = st.button(
                        f"{'📄 Paper Buy' if engine.state.is_paper else '💰 LIVE Buy'} ${pos_size:.2f} of {scored.ticker}",
                        key=f"exec_{scored.ticker}",
                        type="primary"
                    )
                    if execute_btn:
                        if executor.is_configured:
                            result = executor.place_buy(scored.ticker, pos_size)
                            if result.success:
                                entry_price = result.filled_price or scored.price
                                engine.record_trade_open(scored.ticker, pos_size, entry_price, result.order_id or "")
                                st.success(f"[{executor.mode_label}] Bought ${pos_size:.2f} of {scored.ticker} at ~${entry_price:.4f}")
                                st.info(f"Take profit: ${engine.get_take_profit_price(entry_price):.4f} | Stop loss: ${engine.get_stop_loss_price(entry_price):.4f}")
                                st.rerun()
                            else:
                                st.error(f"Order failed: {result.message}")
                        else:
                            # No Alpaca keys — record as manual trade at current price
                            engine.record_trade_open(scored.ticker, pos_size, scored.price, "MANUAL")
                            st.success(f"[MANUAL] Trade recorded — ${pos_size:.2f} of {scored.ticker} at ${scored.price:.4f}. Execute manually in your broker.")
                            st.info(f"Take profit: ${tp:.4f} | Stop loss: ${sl:.4f}")
                            st.rerun()

    st.markdown("---")

    # --- Trade Stats ---
    if engine.state.trade_count > 0:
        st.markdown("### 📊 Performance Summary")
        s1, s2, s3, s4, s5 = st.columns(5)
        s1.metric("Total Trades", engine.state.trade_count)
        s2.metric("Wins", engine.state.win_count)
        s3.metric("Losses", engine.state.loss_count)
        s4.metric("Win Rate", f"{engine.win_rate:.0f}%")
        s5.metric("Peak Balance", f"${engine.state.peak_balance:.2f}")

    st.markdown("---")
    st.caption("Compounder uses Alpaca paper trading by default. Switch to LIVE only after validating performance. Not financial advice.")


# --- EDUCATION PAGE ---
elif page == "📚 Education":
    st.title("📚 Trading Education Center")
    st.info("Learn the basics before risking real money.")
    
    st.markdown("""
    ## Order Types Explained
    
    ### Market Order
    - **What it is:** Buy or sell immediately at the best available current price.
    - **Pros:** Guaranteed to fill quickly.
    - **Cons:** You don't control the exact price. In volatile markets, you might get a worse price than expected ("slippage").
    - **Best for:** Highly liquid stocks when you need in/out fast.
    
    ### Limit Order
    - **What it is:** Buy or sell only at a specific price or better.
    - **Pros:** Price control. You won't overpay.
    - **Cons:** No guarantee of filling. If the price never hits your limit, you get nothing.
    - **Best for:** Patient traders who want a specific entry price.
    
    ### Stop Loss Order
    - **What it is:** An order to sell when a stock drops to a certain price, designed to limit loss.
    - **Pros:** Automatic risk control without watching the screen.
    - **Cons:** In a fast crash, it may execute far below your stop price ("gap down").
    - **Best for:** Protecting profits and capping downside.
    
    ---
    
    ## Key Terms
    
    | Term | Meaning |
    |------|---------|
    | **Ticker** | The stock symbol (e.g., AAPL, F, T) |
    | **Bid** | Highest price a buyer will pay right now |
    | **Ask** | Lowest price a seller will accept right now |
    | **Spread** | Difference between Bid and Ask |
    | **Volume** | Number of shares traded today |
    | **Market Cap** | Total value of all shares (Price × Shares Outstanding) |
    | **RSI** | Relative Strength Index. 0-30 = oversold, 70-100 = overbought |
    | **MACD** | Moving Average Convergence Divergence. Trend-following momentum indicator |
    | **SMA** | Simple Moving Average. Average price over N days |
    | **Bollinger Bands** | Volatility bands above/below a moving average |
    
    ---
    
    ## Risk Management Rules (Golden Rules)
    1. **Never risk more than 1-2% of your account on a single trade.**
    2. **Always use stop-losses.** Decide your max loss BEFORE you buy.
    3. **Don't put more than 20% in one stock.** Diversify.
    4. **Keep cash reserves.** Don't be 100% invested.
    5. **Paper trade first.** Practice for weeks or months.
    6. **Never trade with money you need for rent/food/bills.**
    7. **Emotions are your enemy.** Fear and greed cause bad decisions.
    
    ---
    
    ## Common Beginner Mistakes
    - ❌ Buying because someone on social media said so
    - ❌ Investing all money at once ("all-in")
    - ❌ Not using stop losses
    - ❌ Trading on margin (borrowing money) as a beginner
    - ❌ Day trading without understanding pattern day trader rules ($25k minimum)
    - ❌ Ignoring fees and taxes
    - ❌ Panic selling when the market dips
    
    ---
    
    ## The Pattern Day Trader (PDT) Rule
    If you make **4 or more day trades** (buy and sell the same stock in one day) within **5 business days** in a US margin account under **$25,000**, your broker will restrict your account.
    
    **How to avoid:**
    - Use a cash account (not margin)
    - Hold stocks overnight (swing trade instead of day trade)
    - Keep account above $25,000
    
    ---
    
    ## Options Basics
    
    ### What is an Option?
    An option is a contract that gives you the **right**, but not the obligation, to buy (Call) or sell (Put) a stock at a specific price (strike) by a specific date (expiration).
    
    ### Key Options Terms
    | Term | Meaning |
    |------|---------|
    | **Call** | Right to BUY stock at strike price |
    | **Put** | Right to SELL stock at strike price |
    | **Strike** | The agreed price in the contract |
    | **Expiration** | The deadline for the contract |
    | **Premium** | The price you pay to buy the option |
    | **ITM** | In-The-Money (profitable if exercised now) |
    | **OTM** | Out-of-The-Money (not profitable if exercised now) |
    | **IV** | Implied Volatility - market's expectation of future volatility |
    
    ### Defined Risk Strategies
    These strategies cap your maximum loss:
    - **Long Call/Put**: Max loss = premium paid
    - **Debit Spread**: Max loss = net debit paid
    - **Credit Spread**: Max loss = width of spread minus credit received
    
    ### Options Approval Levels
    Most brokers require approval:
    - **Level 1**: Covered calls, cash-secured puts
    - **Level 2**: Long calls/puts, debit spreads
    - **Level 3**: Credit spreads, naked puts
    - **Level 4**: Naked calls (very risky, large accounts only)
    
    ---
    
    *Remember: The stock market is not a casino, but it's also not a guaranteed ATM. Educate yourself, practice, and never stop learning.*
    """)


# Footer
st.markdown("---")
st.caption(f"{APP_NAME} v{APP_VERSION} | Educational Purposes Only | Not Financial Advice | Data delayed unless real-time API configured")
