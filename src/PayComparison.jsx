import { useState, useEffect, useRef } from "react";
import payData from "./payscales.json";

const PAY_SCALES = payData.scales;

const fmt = (n) => n.toLocaleString("en-IE", { style: "currency", currency: "EUR" });
const fmtShort = (n) => n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// First fortnightly payment: Feb 12, 2026 (Thursday)
const FORTNIGHTLY_ANCHOR = new Date(2026, 1, 12);
const TRANSITION_YEAR = 2026;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Year range for the selector
const YEAR_RANGE = Array.from({ length: 23 }, (_, i) => 2026 + i); // 2026-2048

// Get day-of-year index (0 = Jan 1)
function getDayOfYear(date) {
  const jan1 = new Date(date.getFullYear(), 0, 1);
  return Math.round((date - jan1) / MS_PER_DAY);
}

// Days in a year (365 or 366)
function daysInYear(year) {
  return (new Date(year, 1, 29).getMonth() === 1) ? 366 : 365;
}

// Format a date as "Thu 12 Feb"
function fmtDate(d) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Get all fortnightly pay dates for a given year, anchored to Feb 12, 2026
function getFortnightlyPayDates(year) {
  const dates = [];
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  // Find first fortnightly date on or after yearStart
  const diffMs = yearStart.getTime() - FORTNIGHTLY_ANCHOR.getTime();
  const diffDays = Math.round(diffMs / MS_PER_DAY);

  let n;
  if (diffDays <= 0) {
    n = 0; // anchor is after or on yearStart
  } else {
    n = Math.ceil(diffDays / 14);
  }

  while (true) {
    const d = new Date(FORTNIGHTLY_ANCHOR);
    d.setDate(d.getDate() + n * 14);
    if (d > yearEnd) break;
    if (d >= yearStart) {
      dates.push(new Date(d));
    }
    n++;
  }
  return dates;
}

// Get monthly pay dates: last Friday of each month, except Dec (last Friday before Christmas)
function getMonthlyPayDates(year) {
  const dates = [];
  for (let m = 0; m < 12; m++) {
    let d;
    if (m === 11) {
      // December: last Friday before Dec 25
      d = new Date(year, 11, 24);
      while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    } else {
      // Last Friday of the month
      d = new Date(year, m + 1, 0); // last day of month
      while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
    }
    dates.push(d);
  }
  return dates;
}

// Pre-compute fortnightly pay counts per year for the 26/27 indicator
function getYearPaydayCounts() {
  const counts = {};
  for (const y of YEAR_RANGE) {
    const dates = getFortnightlyPayDates(y);
    counts[y] = dates.length;
  }
  return counts;
}

const YEAR_PAYDAY_COUNTS = getYearPaydayCounts();

function TimelineBar({ payments, color, systemLabel, year }) {
  const totalDays = daysInYear(year);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "#8a9bb5",
          width: 90,
          textAlign: "right",
          letterSpacing: "0.02em",
        }}>{systemLabel}</span>
        <div style={{
          flex: 1,
          height: 36,
          background: "#1a2235",
          borderRadius: 6,
          position: "relative",
          overflow: "hidden",
          border: "1px solid #2a3a55",
        }}>
          {/* Month gridlines */}
          {MONTHS.map((m, i) => {
            const dayOfYear = getDayOfYear(new Date(year, i, 1));
            const pct = (dayOfYear / totalDays) * 100;
            return i > 0 ? (
              <div key={m} style={{
                position: "absolute",
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(255,255,255,0.06)",
              }} />
            ) : null;
          })}
          {/* Payment blocks */}
          {payments.map((p, i) => (
            <div
              key={i}
              title={p.label}
              style={{
                position: "absolute",
                left: `${p.startPct}%`,
                width: `${Math.max(p.widthPct, 0.3)}%`,
                top: 3,
                bottom: 3,
                background: p.color || color,
                borderRadius: 3,
                opacity: 0.85,
                transition: "opacity 0.2s",
                cursor: "pointer",
              }}
              onMouseEnter={e => e.target.style.opacity = 1}
              onMouseLeave={e => e.target.style.opacity = 0.85}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AccumulationChart({ salary, playing, dayIndex, year, monthlyDates, fortnightlyDates }) {
  const canvasRef = useRef(null);
  const monthly = salary / 12;
  const fortnightly = salary / 26.09;
  const dailyRate = salary / daysInYear(year);
  const totalDays = daysInYear(year);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const pad = { top: 30, right: 20, bottom: 35, left: 65 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0d1420";
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Month labels
    ctx.fillStyle = "#5a6a82";
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    MONTHS.forEach((m, i) => {
      const dayStart = getDayOfYear(new Date(year, i, 1));
      const nextMonth = i < 11 ? getDayOfYear(new Date(year, i + 1, 1)) : totalDays;
      const midDay = dayStart + (nextMonth - dayStart) / 2;
      const x = pad.left + (midDay / totalDays) * plotW;
      ctx.fillText(m, x, H - 8);

      if (i > 0) {
        const lineX = pad.left + (dayStart / totalDays) * plotW;
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.moveTo(lineX, pad.top);
        ctx.lineTo(lineX, pad.top + plotH);
        ctx.stroke();
      }
    });

    // Y-axis labels
    ctx.fillStyle = "#5a6a82";
    ctx.textAlign = "right";
    ctx.font = "10px 'JetBrains Mono', monospace";
    for (let i = 0; i <= 4; i++) {
      const val = (salary / 4) * (4 - i);
      const y = pad.top + (plotH / 4) * i;
      ctx.fillText(`\u20AC${(val / 1000).toFixed(0)}k`, pad.left - 8, y + 4);
    }

    const maxDay = dayIndex;

    // Build sets of pay day indices
    const monthlyPayDays = new Set(monthlyDates.map(d => getDayOfYear(d)));
    const fnPayDays = new Set(fortnightlyDates.map(d => getDayOfYear(d)));

    // For 2026 transition: January was paid monthly, fortnightly starts Feb 12
    // The fortnightly line shows the actual new system (no Jan payment)
    // The monthly line shows the old system for comparison

    // Calculate cumulative pay for both systems
    const monthlyAccum = [];
    const fnAccum = [];
    let mTotal = 0;
    let fTotal = 0;

    // Track pay date positions for dot markers
    const monthlyDots = [];
    const fnDots = [];

    for (let d = 0; d <= totalDays; d++) {
      if (monthlyPayDays.has(d)) {
        mTotal += monthly;
        monthlyDots.push({ day: d, total: mTotal });
      }
      monthlyAccum.push(mTotal);

      if (fnPayDays.has(d)) {
        fTotal += fortnightly;
        fnDots.push({ day: d, total: fTotal });
      }
      fnAccum.push(fTotal);
    }

    // "What you actually earned" line (daily accumulation)
    const drawEarned = (upToDay) => {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let d = 0; d <= upToDay; d++) {
        const x = pad.left + (d / totalDays) * plotW;
        const y = pad.top + plotH - ((d * dailyRate) / salary) * plotH;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Draw staircase line
    const drawLine = (data, color, upToDay) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let d = 0; d <= Math.min(upToDay, totalDays); d++) {
        const x = pad.left + (d / totalDays) * plotW;
        const y = pad.top + plotH - (data[d] / salary) * plotH;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    // Draw dots at pay dates
    const drawDots = (dots, color, upToDay) => {
      ctx.fillStyle = color;
      for (const dot of dots) {
        if (dot.day > upToDay) break;
        const x = pad.left + (dot.day / totalDays) * plotW;
        const y = pad.top + plotH - (dot.total / salary) * plotH;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawEarned(maxDay);
    drawLine(monthlyAccum, "#f59e0b", maxDay);
    drawLine(fnAccum, "#22d3ee", maxDay);
    drawDots(monthlyDots, "#f59e0b", maxDay);
    drawDots(fnDots, "#22d3ee", maxDay);

    // 2026 transition marker
    if (year === TRANSITION_YEAR && maxDay >= getDayOfYear(FORTNIGHTLY_ANCHOR)) {
      const anchorDay = getDayOfYear(FORTNIGHTLY_ANCHOR);
      const x = pad.left + (anchorDay / totalDays) * plotW;
      ctx.strokeStyle = "rgba(34,211,238,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = "rgba(34,211,238,0.6)";
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("First fortnightly", x + 4, pad.top + 12);
      ctx.fillText("Feb 12", x + 4, pad.top + 22);
    }

    // Playhead
    if (maxDay < totalDays) {
      const x = pad.left + (maxDay / totalDays) * plotW;
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + plotH);
      ctx.stroke();
    }

    // Legend
    const legendY = 14;
    const items = [
      { color: "#f59e0b", label: "Monthly (old)" },
      { color: "#22d3ee", label: "Fortnightly (new)" },
      { color: "rgba(255,255,255,0.3)", label: "Daily salary earned", dash: true },
    ];
    let lx = pad.left;
    items.forEach(item => {
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.lineWidth = 2.5;
      if (item.dash) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(lx, legendY);
      ctx.lineTo(lx + 20, legendY);
      ctx.stroke();
      ctx.setLineDash([]);
      // dot marker for non-dashed
      if (!item.dash) {
        ctx.beginPath();
        ctx.arc(lx + 10, legendY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(item.label, lx + 24, legendY + 3);
      lx += ctx.measureText(item.label).width + 50;
    });

  }, [salary, dayIndex, year, monthlyDates, fortnightlyDates, totalDays, monthly, fortnightly, dailyRate]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={300}
      style={{
        width: "100%",
        maxWidth: 700,
        height: "auto",
        borderRadius: 8,
        border: "1px solid #2a3a55",
      }}
    />
  );
}

// Pay date schedule component
function PayDateSchedule({ year, monthlyDates, fortnightlyDates, monthly, fortnightly }) {
  const isTransition = year === TRANSITION_YEAR;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16,
      marginTop: 16,
    }}>
      {/* Monthly dates */}
      <div>
        <div style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: "#f59e0b",
          marginBottom: 8,
          letterSpacing: "0.03em",
        }}>MONTHLY PAY DATES ({monthlyDates.length})</div>
        <div style={{
          background: "#1a2235",
          borderRadius: 8,
          border: "1px solid #2a3a55",
          padding: "8px 0",
          maxHeight: 320,
          overflowY: "auto",
        }}>
          {monthlyDates.map((d, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              borderBottom: i < monthlyDates.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ color: "#94a3b8" }}>{fmtDate(d)}</span>
              <span style={{ color: "#f59e0b" }}>{fmt(monthly)}</span>
            </div>
          ))}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            borderTop: "1px solid #2a3a55",
            marginTop: 4,
          }}>
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>Total</span>
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>{fmt(monthly * monthlyDates.length)}</span>
          </div>
        </div>
      </div>

      {/* Fortnightly dates */}
      <div>
        <div style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          color: "#22d3ee",
          marginBottom: 8,
          letterSpacing: "0.03em",
        }}>FORTNIGHTLY PAY DATES ({fortnightlyDates.length}){isTransition ? " *" : ""}</div>
        <div style={{
          background: "#1a2235",
          borderRadius: 8,
          border: "1px solid #2a3a55",
          padding: "8px 0",
          maxHeight: 320,
          overflowY: "auto",
        }}>
          {fortnightlyDates.map((d, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "5px 12px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              borderBottom: i < fortnightlyDates.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ color: "#94a3b8" }}>{fmtDate(d)}</span>
              <span style={{ color: "#22d3ee" }}>{fmt(fortnightly)}</span>
            </div>
          ))}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 12px",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            borderTop: "1px solid #2a3a55",
            marginTop: 4,
          }}>
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>Total</span>
            <span style={{ color: "#22d3ee", fontWeight: 600 }}>{fmt(fortnightly * fortnightlyDates.length)}</span>
          </div>
        </div>
        {isTransition && (
          <div style={{
            fontSize: 10,
            color: "#64748b",
            marginTop: 6,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.5,
          }}>
            * 2026 is the transition year. January was paid monthly under the old system.
            Fortnightly payments began Feb 12.
          </div>
        )}
      </div>
    </div>
  );
}

export default function PayComparison() {
  const scaleNames = Object.keys(PAY_SCALES);
  const [scale, setScale] = useState(scaleNames.find(s => s.includes("Lecturer /")) || scaleNames[0]);
  const [pointIdx, setPointIdx] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [dayIndex, setDayIndex] = useState(365);
  const [year, setYear] = useState(2026);
  const [showDates, setShowDates] = useState(false);
  const animRef = useRef(null);

  const points = PAY_SCALES[scale];
  const salary = points[pointIdx].salary;
  const monthly = salary / 12;
  const fortnightly = salary / 26.09;

  // Compute actual pay dates for selected year
  const fortnightlyDates = getFortnightlyPayDates(year);
  const monthlyDates = getMonthlyPayDates(year);
  const fnCount = fortnightlyDates.length;
  const isTransitionYear = year === TRANSITION_YEAR;
  const totalDays = daysInYear(year);

  useEffect(() => {
    setDayIndex(totalDays);
  }, [year, totalDays]);

  useEffect(() => {
    if (playing) {
      setDayIndex(0);
      let day = 0;
      const maxDay = totalDays;
      const tick = () => {
        day += 2;
        if (day > maxDay) {
          day = maxDay;
          setPlaying(false);
        }
        setDayIndex(day);
        if (day < maxDay) {
          animRef.current = requestAnimationFrame(tick);
        }
      };
      animRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [playing, totalDays]);

  // Build payment blocks for timeline using actual dates
  const monthlyPayments = monthlyDates.map((d, i) => {
    const dayIdx = getDayOfYear(d);
    // Block spans from previous pay date (or start of year) to this pay date
    const prevDay = i === 0 ? 0 : getDayOfYear(monthlyDates[i - 1]);
    const startDay = i === 0 ? 0 : prevDay;
    const blockWidth = dayIdx - startDay;
    return {
      startPct: (startDay / totalDays) * 100,
      widthPct: (blockWidth / totalDays) * 100 - 0.3,
      amount: monthly,
      label: `${fmtDate(d)}: ${fmt(monthly)}`,
    };
  });

  const fnPayments = fortnightlyDates.map((d, i) => {
    const dayIdx = getDayOfYear(d);
    const startDay = i === 0
      ? (isTransitionYear ? getDayOfYear(FORTNIGHTLY_ANCHOR) - 14 : dayIdx - 14)
      : getDayOfYear(fortnightlyDates[i - 1]);
    const effectiveStart = Math.max(startDay, 0);
    const blockWidth = dayIdx - effectiveStart;
    return {
      startPct: (effectiveStart / totalDays) * 100,
      widthPct: (blockWidth / totalDays) * 100 - 0.15,
      amount: fortnightly,
      label: `${fmtDate(d)}: ${fmt(fortnightly)}`,
    };
  });

  const annualFn26 = 26 * fortnightly;
  const annualFn27 = 27 * fortnightly;
  const diff26 = salary - annualFn26;
  const diff27 = annualFn27 - salary;

  return (
    <div style={{
      background: "#0d1420",
      color: "#e2e8f0",
      minHeight: "100vh",
      fontFamily: "'IBM Plex Sans', -apple-system, sans-serif",
      padding: "24px 20px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select, button { font-family: inherit; }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{
            display: "inline-block",
            padding: "4px 12px",
            background: "rgba(34,211,238,0.1)",
            border: "1px solid rgba(34,211,238,0.2)",
            borderRadius: 20,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            color: "#22d3ee",
            letterSpacing: "0.05em",
            marginBottom: 12,
          }}>ATU PAY SYSTEM COMPARISON</div>
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1.2,
            marginBottom: 6,
          }}>Monthly vs Fortnightly Pay</h1>
          <p style={{
            fontSize: 14,
            color: "#64748b",
            maxWidth: 500,
            margin: "0 auto",
          }}>Same salary. Different rhythm. Select your scale to see the numbers.</p>
        </div>

        {/* Scale selector */}
        <div style={{
          display: "flex",
          gap: 12,
          marginBottom: 28,
          flexWrap: "wrap",
          justifyContent: "center",
        }}>
          <select
            value={scale}
            onChange={e => { setScale(e.target.value); setPointIdx(0); }}
            style={{
              background: "#1a2235",
              color: "#e2e8f0",
              border: "1px solid #2a3a55",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              cursor: "pointer",
              outline: "none",
              minWidth: 200,
            }}
          >
            {scaleNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={pointIdx}
            onChange={e => setPointIdx(Number(e.target.value))}
            style={{
              background: "#1a2235",
              color: "#e2e8f0",
              border: "1px solid #2a3a55",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 14,
              cursor: "pointer",
              outline: "none",
              minWidth: 220,
            }}
          >
            {points.map((p, i) => (
              <option key={i} value={i}>{p.label ? `${p.label}` : `Point ${p.point}`}: {fmt(p.salary)}</option>
            ))}
          </select>
        </div>

        {/* Key numbers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 28,
        }}>
          {[
            { label: "Annual Salary", value: fmt(salary), sub: "Same in both systems" },
            { label: "Monthly Payment", value: fmt(monthly), sub: `\u00F7 12 = ${fmtShort(monthly)}`, color: "#f59e0b" },
            { label: "Fortnightly Payment", value: fmt(fortnightly), sub: `\u00F7 26.09 = ${fmtShort(fortnightly)}`, color: "#22d3ee" },
          ].map((item, i) => (
            <div key={i} style={{
              background: "#1a2235",
              border: "1px solid #2a3a55",
              borderRadius: 10,
              padding: "16px 14px",
              textAlign: "center",
            }}>
              <div style={{
                fontSize: 11,
                color: "#64748b",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.03em",
                marginBottom: 6,
              }}>{item.label}</div>
              <div style={{
                fontSize: 20,
                fontWeight: 700,
                color: item.color || "#f8fafc",
                fontFamily: "'JetBrains Mono', monospace",
              }}>{item.value}</div>
              <div style={{
                fontSize: 10,
                color: "#475569",
                marginTop: 4,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div style={{
          background: "#131d2e",
          border: "1px solid #2a3a55",
          borderRadius: 12,
          padding: "20px 16px",
          marginBottom: 20,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
              Payment Timeline — {year}
            </h2>
            <span style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#475569",
            }}>hover blocks for amounts</span>
          </div>

          {/* Month labels */}
          <div style={{ display: "flex", marginLeft: 98, marginBottom: 6 }}>
            {MONTHS.map((m) => (
              <div key={m} style={{
                flex: 1,
                fontSize: 9,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#475569",
                textAlign: "left",
              }}>{m}</div>
            ))}
          </div>

          <TimelineBar
            payments={monthlyPayments}
            color="#f59e0b"
            systemLabel="MONTHLY"
            year={year}
          />
          <TimelineBar
            payments={fnPayments}
            color="#22d3ee"
            systemLabel="FORTNIGHTLY"
            year={year}
          />

          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            {monthlyDates.length} monthly payments vs {fnCount} fortnightly payments in {year}
            {isTransitionYear && " (fortnightly began Feb 12)"}
          </div>

          <div style={{
            marginTop: 10,
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.15)",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: 11,
            color: "#94a3b8",
            lineHeight: 1.6,
          }}>
            <strong style={{ color: "#f59e0b" }}>Old system note:</strong> Monthly pay was the last Friday of each month, except December
            which was paid early (last Friday before Christmas). That meant a ~5 week gap between December and January pay —
            the old system had its own uneven rhythm too.
          </div>
        </div>

        {/* Accumulation chart */}
        <div style={{
          background: "#131d2e",
          border: "1px solid #2a3a55",
          borderRadius: 12,
          padding: "20px 16px",
          marginBottom: 20,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 10,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
              How Your Pay Accumulates — {year}
            </h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select
                value={year}
                onChange={e => { setYear(Number(e.target.value)); setPlaying(false); }}
                style={{
                  background: "#1a2235",
                  color: "#e2e8f0",
                  border: "1px solid #2a3a55",
                  borderRadius: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {YEAR_RANGE.map(y => (
                  <option key={y} value={y}>
                    {y} ({YEAR_PAYDAY_COUNTS[y]} paydays{y === TRANSITION_YEAR ? " *" : ""})
                  </option>
                ))}
              </select>
              <button
                onClick={() => { if (!playing) setPlaying(true); }}
                style={{
                  background: playing ? "#1e293b" : "rgba(34,211,238,0.15)",
                  color: playing ? "#475569" : "#22d3ee",
                  border: `1px solid ${playing ? "#2a3a55" : "rgba(34,211,238,0.3)"}`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  cursor: playing ? "default" : "pointer",
                }}
              >
                {playing ? "Playing..." : "\u25B6 Animate"}
              </button>
            </div>
          </div>

          {/* 26/27 payday year overview */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 4,
            marginBottom: 14,
            justifyContent: "center",
          }}>
            {YEAR_RANGE.map(y => {
              const count = YEAR_PAYDAY_COUNTS[y];
              const is27 = count === 27;
              const isSelected = y === year;
              const isTransition = y === TRANSITION_YEAR;
              return (
                <button
                  key={y}
                  onClick={() => { setYear(y); setPlaying(false); }}
                  style={{
                    background: isSelected
                      ? (is27 ? "rgba(34,211,238,0.25)" : "rgba(245,158,11,0.2)")
                      : "#1a2235",
                    color: isSelected
                      ? "#f8fafc"
                      : (is27 ? "#22d3ee" : "#64748b"),
                    border: `1px solid ${isSelected
                      ? (is27 ? "rgba(34,211,238,0.5)" : "rgba(245,158,11,0.4)")
                      : "#2a3a55"}`,
                    borderRadius: 6,
                    padding: "4px 8px",
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    cursor: "pointer",
                    position: "relative",
                    outline: "none",
                    fontWeight: isSelected ? 700 : 400,
                  }}
                  title={`${y}: ${count} fortnightly paydays${isTransition ? " (transition year)" : ""}`}
                >
                  {y}
                  {isTransition && <span style={{ color: "#f59e0b", marginLeft: 2 }}>*</span>}
                  <div style={{
                    fontSize: 8,
                    color: is27 ? "#22d3ee" : "#475569",
                    marginTop: 1,
                  }}>{count}</div>
                </button>
              );
            })}
          </div>

          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 16,
            marginBottom: 12,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            <span style={{ color: "#64748b" }}>26 paydays = most years</span>
            <span style={{ color: "#22d3ee" }}>27 paydays = highlighted</span>
            {<span style={{ color: "#f59e0b" }}>* = transition year</span>}
          </div>

          <AccumulationChart
            salary={salary}
            playing={playing}
            dayIndex={dayIndex}
            year={year}
            monthlyDates={monthlyDates}
            fortnightlyDates={fortnightlyDates}
          />

          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            {isTransitionYear ? (
              <>
                <strong style={{ color: "#f59e0b" }}>2026 is the transition year.</strong> January was paid monthly (old system).
                <br />Fortnightly payments began Feb 12, so the cyan line starts in February.
                <br />Dots mark each actual pay date. The monthly staircase has 12 big steps, the fortnightly has {fnCount} smaller steps.
              </>
            ) : (
              <>
                Both systems follow the dashed line (actual salary earned) — just in different step patterns.
                <br />The monthly staircase has 12 big steps. The fortnightly staircase has {fnCount} smaller steps.
                <br />{fnCount === 27
                  ? `${year} is a 27-payday year — one extra paycheck falls in this calendar year, making the fortnightly total slightly exceed the annual salary.`
                  : `${year} is a 26-payday year — the fortnightly total falls just short of the annual salary. The remainder rolls into January ${year + 1}.`
                }
              </>
            )}
          </div>

          {/* Toggle pay date schedule */}
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <button
              onClick={() => setShowDates(!showDates)}
              style={{
                background: showDates ? "rgba(34,211,238,0.1)" : "transparent",
                color: "#22d3ee",
                border: "1px solid rgba(34,211,238,0.2)",
                borderRadius: 6,
                padding: "6px 16px",
                fontSize: 12,
                fontFamily: "'JetBrains Mono', monospace",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {showDates ? "Hide" : "Show"} all pay dates for {year}
            </button>
          </div>

          {showDates && (
            <PayDateSchedule
              year={year}
              monthlyDates={monthlyDates}
              fortnightlyDates={fortnightlyDates}
              monthly={monthly}
              fortnightly={fortnightly}
            />
          )}
        </div>

        {/* Calendar year counting */}
        <div style={{
          background: "#131d2e",
          border: "1px solid #2a3a55",
          borderRadius: 12,
          padding: "20px 16px",
          marginBottom: 20,
        }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0", marginBottom: 14 }}>
            The Calendar Year "Problem" (That Isn't One)
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{
              background: "#1a2235",
              borderRadius: 8,
              padding: 16,
              borderLeft: "3px solid #f59e0b",
            }}>
              <div style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#f59e0b",
                marginBottom: 8,
              }}>26-PAYDAY YEAR (MOST YEARS)</div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#e2e8f0",
              }}>26 x {fmtShort(fortnightly)}</div>
              <div style={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#94a3b8",
                margin: "4px 0",
              }}>= {fmt(annualFn26)}</div>
              <div style={{
                fontSize: 12,
                color: "#ef4444",
                fontFamily: "'JetBrains Mono', monospace",
              }}>{"\u2212"}{fmt(diff26)} vs annual salary</div>
              <div style={{
                fontSize: 11,
                color: "#475569",
                marginTop: 8,
                lineHeight: 1.5,
              }}>This {"\u20AC"}{fmtShort(diff26)} is not missing — it's in your next paycheck, which lands in January.</div>
            </div>

            <div style={{
              background: "#1a2235",
              borderRadius: 8,
              padding: 16,
              borderLeft: "3px solid #22d3ee",
            }}>
              <div style={{
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#22d3ee",
                marginBottom: 8,
              }}>27-PAYDAY YEAR (EVERY ~5-6 YRS)</div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#e2e8f0",
              }}>27 x {fmtShort(fortnightly)}</div>
              <div style={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', monospace",
                color: "#94a3b8",
                margin: "4px 0",
              }}>= {fmt(annualFn27)}</div>
              <div style={{
                fontSize: 12,
                color: "#22c55e",
                fontFamily: "'JetBrains Mono', monospace",
              }}>+{fmt(diff27)} vs annual salary</div>
              <div style={{
                fontSize: 11,
                color: "#475569",
                marginTop: 8,
                lineHeight: 1.5,
              }}>This isn't bonus money — it includes a paycheck earned in the previous December.</div>
            </div>
          </div>

          {/* Which years are 26 vs 27 */}
          <div style={{
            background: "#1a2235",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 14,
          }}>
            <div style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#8a9bb5",
              marginBottom: 8,
            }}>UPCOMING 27-PAYDAY YEARS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {YEAR_RANGE.filter(y => YEAR_PAYDAY_COUNTS[y] === 27).map(y => (
                <span key={y} style={{
                  background: "rgba(34,211,238,0.12)",
                  color: "#22d3ee",
                  border: "1px solid rgba(34,211,238,0.25)",
                  borderRadius: 4,
                  padding: "3px 10px",
                  fontSize: 12,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                }}>{y}</span>
              ))}
            </div>
          </div>

          <div style={{
            background: "rgba(34,211,238,0.05)",
            border: "1px solid rgba(34,211,238,0.15)",
            borderRadius: 8,
            padding: 14,
            fontSize: 13,
            color: "#94a3b8",
            lineHeight: 1.6,
            textAlign: "center",
          }}>
            <strong style={{ color: "#22d3ee" }}>Neither is real.</strong> Both are caused by trying to fit 14-day payment cycles into calendar years.
            <br />Your pay is a continuous stream — every 14 days, {fmt(fortnightly)} — regardless of what the calendar says.
          </div>
        </div>

        {/* The key insight */}
        <div style={{
          background: "linear-gradient(135deg, rgba(34,211,238,0.08), rgba(34,211,238,0.02))",
          border: "1px solid rgba(34,211,238,0.2)",
          borderRadius: 12,
          padding: "24px 20px",
          textAlign: "center",
          marginBottom: 20,
        }}>
          <div style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#f8fafc",
            marginBottom: 10,
            lineHeight: 1.4,
          }}>The Simple Truth</div>
          <div style={{
            fontSize: 14,
            color: "#94a3b8",
            lineHeight: 1.8,
            maxWidth: 560,
            margin: "0 auto",
          }}>
            <strong style={{ color: "#f59e0b" }}>Old system:</strong> salary split into 12 equal chunks, paid last Friday of each month (except December — paid early before Christmas). Calendar dates matter.
            <br />
            <strong style={{ color: "#22d3ee" }}>New system:</strong> salary paid every second Thursday for 14 days of work. Calendar dates are irrelevant.
            <br /><br />
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
              Same annual salary. Same pension. Same career earnings.
              <br />Just a different rhythm.
            </span>
          </div>
        </div>

        <div style={{
          textAlign: "center",
          fontSize: 11,
          color: "#334155",
          fontFamily: "'JetBrains Mono', monospace",
          padding: "8px 0 16px",
          lineHeight: 1.8,
        }}>
          ATU Galway — Staff Pay Information Tool
          <br />
          Pay scales from <a href={payData.source} target="_blank" rel="noopener noreferrer" style={{ color: "#475569" }}>TUI.ie</a> — updated {payData.lastUpdated}
        </div>
      </div>
    </div>
  );
}
