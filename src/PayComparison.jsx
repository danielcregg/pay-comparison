import { useState, useEffect, useRef } from "react";

const PAY_SCALES = {
  "Assistant Lecturer": [
    { point: 1, salary: 47101 },
    { point: 2, salary: 49603 },
    { point: 3, salary: 51664 },
    { point: 4, salary: 55553 },
    { point: 5, salary: 57157 },
    { point: 6, salary: 58795 },
    { point: 7, salary: 62096 },
    { point: 8, salary: 63735 },
  ],
  "Lecturer": [
    { point: 1, salary: 68936 },
    { point: 2, salary: 72110 },
    { point: 3, salary: 83178 },
    { point: 4, salary: 86075 },
    { point: 5, salary: 89004 },
    { point: 6, salary: 91946 },
    { point: 7, salary: 94903 },
    { point: 8, salary: 97838 },
    { point: 9, salary: 100772 },
    { point: 10, salary: 103720 },
    { point: 11, salary: 106661 },
  ],
};

const fmt = (n) => n.toLocaleString("en-IE", { style: "currency", currency: "EUR" });
const fmtShort = (n) => n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Generate 2026 fortnightly pay dates (every second Thursday from Jan 1)
function getFortnightlyDates2026() {
  const dates = [];
  let d = new Date(2026, 0, 1); // Jan 1 2026 is Thursday
  while (d.getFullYear() === 2026) {
    dates.push(new Date(d));
    d.setDate(d.getDate() + 14);
  }
  return dates;
}

// Generate monthly pay dates (last Thursday of each month)
function getMonthlyDates2026() {
  const dates = [];
  for (let m = 0; m < 12; m++) {
    dates.push(new Date(2026, m, 28)); // approximate end of month
  }
  return dates;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function TimelineBar({ payments, totalDays, color, label, amount, systemLabel }) {
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
            const dayOfYear = new Date(2026, i, 1).getTime();
            const jan1 = new Date(2026, 0, 1).getTime();
            const pct = ((dayOfYear - jan1) / (365.25 * 24 * 60 * 60 * 1000)) * 100;
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
              title={`${p.label}: ${fmt(p.amount)}`}
              style={{
                position: "absolute",
                left: `${p.startPct}%`,
                width: `${Math.max(p.widthPct, 0.3)}%`,
                top: 3,
                bottom: 3,
                background: color,
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

function AccumulationChart({ salary, playing, dayIndex }) {
  const canvasRef = useRef(null);
  const monthly = salary / 12;
  const fortnightly = salary / 26.09;
  const dailyRate = salary / 365.25;

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
      const dayStart = Math.round((i / 12) * 365.25);
      const x = pad.left + (dayStart / 365.25) * plotW;
      ctx.fillText(m, x + plotW / 24, H - 8);

      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + plotH);
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
      ctx.fillText(`€${(val / 1000).toFixed(0)}k`, pad.left - 8, y + 4);
    }

    const maxDay = dayIndex;

    // Calculate cumulative pay for both systems
    const monthlyAccum = [];
    const fnAccum = [];
    let mTotal = 0;
    let fTotal = 0;

    for (let d = 0; d <= 365; d++) {
      // Monthly: paid on day ~30.4, 60.8, 91.3, etc.
      const monthNum = Math.floor(d / 30.4375);
      const prevMonthNum = d > 0 ? Math.floor((d - 1) / 30.4375) : -1;
      if (monthNum > prevMonthNum && monthNum <= 12) {
        mTotal += monthly;
      }
      monthlyAccum.push(mTotal);

      // Fortnightly: paid every 14 days
      if (d > 0 && d % 14 === 0) {
        fTotal += fortnightly;
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
        const x = pad.left + (d / 365.25) * plotW;
        const y = pad.top + plotH - ((d * dailyRate) / salary) * plotH;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Draw monthly line
    const drawLine = (data, color, upToDay) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let d = 0; d <= Math.min(upToDay, 365); d++) {
        const x = pad.left + (d / 365.25) * plotW;
        const y = pad.top + plotH - (data[d] / salary) * plotH;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    drawEarned(maxDay);
    drawLine(monthlyAccum, "#f59e0b", maxDay);
    drawLine(fnAccum, "#22d3ee", maxDay);

    // Playhead
    if (maxDay < 366) {
      const x = pad.left + (maxDay / 365.25) * plotW;
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
      { color: "#f59e0b", label: "Monthly payments" },
      { color: "#22d3ee", label: "Fortnightly payments" },
      { color: "rgba(255,255,255,0.3)", label: "Actual salary earned", dash: true },
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
      ctx.font = "10px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(item.label, lx + 24, legendY + 3);
      lx += ctx.measureText(item.label).width + 50;
    });

  }, [salary, dayIndex]);

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

export default function PayComparison() {
  const [scale, setScale] = useState("Lecturer");
  const [pointIdx, setPointIdx] = useState(4);
  const [playing, setPlaying] = useState(false);
  const [dayIndex, setDayIndex] = useState(365);
  const animRef = useRef(null);

  const points = PAY_SCALES[scale];
  const salary = points[pointIdx].salary;
  const monthly = salary / 12;
  const fortnightly = salary / 26.09;
  const dailyRate = salary / 365.25;

  useEffect(() => {
    if (playing) {
      setDayIndex(0);
      let day = 0;
      const tick = () => {
        day += 2;
        if (day > 365) {
          day = 365;
          setPlaying(false);
        }
        setDayIndex(day);
        if (day < 365) {
          animRef.current = requestAnimationFrame(tick);
        }
      };
      animRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [playing]);

  // Build payment blocks for timeline
  const monthlyPayments = [];
  for (let m = 0; m < 12; m++) {
    const startDay = m * 30.4375;
    monthlyPayments.push({
      startPct: (startDay / 365.25) * 100,
      widthPct: (30.4375 / 365.25) * 100 - 0.3,
      amount: monthly,
      label: `${MONTHS[m]}: ${fmt(monthly)}`,
    });
  }

  const fnPayments = [];
  for (let f = 0; f < 26; f++) {
    const startDay = f * 14;
    fnPayments.push({
      startPct: (startDay / 365.25) * 100,
      widthPct: (14 / 365.25) * 100 - 0.15,
      amount: fortnightly,
      label: `Fortnight ${f + 1}: ${fmt(fortnightly)}`,
    });
  }

  // Count paydays by month
  const fnByMonth = {};
  MONTHS.forEach(m => fnByMonth[m] = 0);
  for (let f = 0; f < 26; f++) {
    const payDate = new Date(2026, 0, 1 + f * 14 + 13);
    fnByMonth[MONTHS[payDate.getMonth()]]++;
  }

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
            <option value="Assistant Lecturer">Assistant Lecturer</option>
            <option value="Lecturer">Lecturer</option>
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
              <option key={i} value={i}>Point {p.point}: {fmt(p.salary)}</option>
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
            { label: "Monthly Payment", value: fmt(monthly), sub: `÷ 12 = ${fmtShort(monthly)}`, color: "#f59e0b" },
            { label: "Fortnightly Payment", value: fmt(fortnightly), sub: `÷ 26.09 = ${fmtShort(fortnightly)}`, color: "#22d3ee" },
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
              Payment Timeline — 2026
            </h2>
            <span style={{
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              color: "#475569",
            }}>hover blocks for amounts</span>
          </div>

          {/* Month labels */}
          <div style={{ display: "flex", marginLeft: 98, marginBottom: 6 }}>
            {MONTHS.map((m, i) => (
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
            totalDays={365}
            color="#f59e0b"
            systemLabel="MONTHLY"
            amount={monthly}
          />
          <TimelineBar
            payments={fnPayments}
            totalDays={365}
            color="#22d3ee"
            systemLabel="FORTNIGHTLY"
            amount={fortnightly}
          />

          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            12 equal blocks vs 26 equal blocks — different slicing, same annual total
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
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
              How Your Pay Accumulates Through the Year
            </h2>
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
              {playing ? "Playing..." : "▶ Animate"}
            </button>
          </div>
          <AccumulationChart salary={salary} playing={playing} dayIndex={dayIndex} />
          <div style={{
            marginTop: 12,
            fontSize: 12,
            color: "#64748b",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            Both systems follow the dashed line (actual salary earned) — just in different step patterns.
            <br />The monthly staircase has 12 big steps. The fortnightly staircase has 26 small steps.
            <br />Both reach the same total at year end.
          </div>
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
              }}>26 × {fmtShort(fortnightly)}</div>
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
              }}>−{fmt(diff26)} vs annual salary</div>
              <div style={{
                fontSize: 11,
                color: "#475569",
                marginTop: 8,
                lineHeight: 1.5,
              }}>This €{fmtShort(diff26)} is not missing — it's in your next paycheck, which lands in January.</div>
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
              }}>27 × {fmtShort(fortnightly)}</div>
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
        }}>
          ATU Galway — Staff Pay Information Tool
        </div>
      </div>
    </div>
  );
}
