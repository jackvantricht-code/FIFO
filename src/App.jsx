import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  Coins,
  Cog,
  Gift,
  Landmark,
  Sparkles,
  TrendingUp,
} from "lucide-react";

const DEFAULTS = {
  baseRate: 31,
  casualUplift: 25,
  travel: 21,
  lafha: 57.5,
  roster: "2:1",
};

const TAX_RATE = 0.27;
const SHIFT_HOURS = 11.5;
const PAYDAY_ANCHOR = new Date("2026-03-26T00:00:00");

const rosterOptions = {
  "2:1": { on: 14, off: 7 },
  "2:2": { on: 14, off: 14 },
  "8:6": { on: 8, off: 6 },
};

const tabs = ["Schedule", "Rates", "Allowances"];
const milestones = [1000, 5000, 10000, 15000, 20000];

function getDayType(dayIndex) {
  const cycle = dayIndex % 7;
  if (cycle === 3) return "Saturday";
  if (cycle === 4) return "Sunday";
  return "Weekday";
}

function calculateCasualHourlyRate(baseRate, casualUpliftPct) {
  return baseRate * (1 + casualUpliftPct / 100);
}

function calculateDailyPay(baseRate, casualUpliftPct, type) {
  const casualRate = calculateCasualHourlyRate(baseRate, casualUpliftPct);

  if (type === "Sunday") return SHIFT_HOURS * baseRate * 2.25;
  if (type === "Saturday") return 2 * baseRate * 1.75 + 9.5 * baseRate * 2.25;
  return 7.6 * casualRate + 2 * baseRate * 1.75 + 1.9 * baseRate * 2.25;
}

function formatMoney(value, cents = 2) {
  return Number(value || 0).toLocaleString("en-AU", {
    minimumFractionDigits: cents,
    maximumFractionDigits: cents,
  });
}

function daysBetween(a, b) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((b - a) / msPerDay);
}

function formatDateForInput(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStoredSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem("settings") || "null");
    return saved && typeof saved === "object" ? saved : null;
  } catch {
    return null;
  }
}

function StatCard({ icon: Icon, label, value, subtext, accentClass = "accent-emerald" }) {
  return (
    <div className="stat-card card">
      <div className="stat-label-row">
        <Icon size={16} className={`stat-icon ${accentClass}`} />
        <span>{label}</span>
      </div>
      <div className="stat-value">{value}</div>
      {subtext ? <div className="stat-subtext">{subtext}</div> : null}
    </div>
  );
}

function MilestoneChip({ value, active }) {
  return (
    <div className={`milestone-chip ${active ? "milestone-chip--active" : ""}`}>
      ${value.toLocaleString()}
    </div>
  );
}

export default function App() {
  const [now, setNow] = useState(new Date());
  const [startDate, setStartDate] = useState(new Date());
  const [roster, setRoster] = useState(DEFAULTS.roster);
  const [afterTax, setAfterTax] = useState(false);
  const [activeTab, setActiveTab] = useState("Schedule");

  const [baseRate, setBaseRate] = useState(DEFAULTS.baseRate);
  const [casualUplift, setCasualUplift] = useState(DEFAULTS.casualUplift);
  const [travel, setTravel] = useState(DEFAULTS.travel);
  const [lafha, setLafha] = useState(DEFAULTS.lafha);

  const [displayValue, setDisplayValue] = useState(0);
  const [milestoneFlash, setMilestoneFlash] = useState(null);

  useEffect(() => {
    const saved = getStoredSettings();
    if (saved) {
      if (saved.roster) setRoster(saved.roster);
      if (saved.startDate) setStartDate(new Date(saved.startDate));
      if (saved.baseRate !== undefined) setBaseRate(Number(saved.baseRate));
      if (saved.casualUplift !== undefined) setCasualUplift(Number(saved.casualUplift));
      if (saved.travel !== undefined) setTravel(Number(saved.travel));
      if (saved.lafha !== undefined) setLafha(Number(saved.lafha));
      if (saved.afterTax !== undefined) setAfterTax(Boolean(saved.afterTax));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "settings",
      JSON.stringify({ roster, startDate, baseRate, casualUplift, travel, lafha, afterTax })
    );
  }, [roster, startDate, baseRate, casualUplift, travel, lafha, afterTax]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  const derived = useMemo(() => {
    const allowancePerDay = Number(travel || 0) + Number(lafha || 0);
    const casualRate = calculateCasualHourlyRate(baseRate, casualUplift);
    const msPerDay = 1000 * 60 * 60 * 24;
    const safeStartDate = Number.isNaN(startDate.getTime()) ? new Date() : startDate;
    const totalDays = Math.max(0, Math.floor((now - safeStartDate) / msPerDay));
    const { on, off } = rosterOptions[roster];
    const cycleLength = on + off;

    let swingEarnings = 0;
    let ytdEarnings = 0;
    let workedDays = 0;
    const currentSwingStart = totalDays - (totalDays % cycleLength);

    for (let i = 0; i <= totalDays; i += 1) {
      const cycleDay = i % cycleLength;
      const isWorking = cycleDay < on;
      if (!isWorking) continue;

      const type = getDayType(i);
      const basePay = calculateDailyPay(baseRate, casualUplift, type);
      const taxedBase = afterTax ? basePay * (1 - TAX_RATE) : basePay;
      const totalPay = taxedBase + allowancePerDay;

      ytdEarnings += totalPay;
      workedDays += 1;
      if (i >= currentSwingStart) swingEarnings += totalPay;
    }

    const todayCycleDay = totalDays % cycleLength;
    const isWorkingToday = todayCycleDay < on;

    let liveToday = 0;
    if (isWorkingToday) {
      const secondsWorkedToday = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const type = getDayType(totalDays);
      const basePay = calculateDailyPay(baseRate, casualUplift, type);
      const taxedBase = afterTax ? basePay * (1 - TAX_RATE) : basePay;
      const todayTotalRate = taxedBase + allowancePerDay;
      const perSecondRate = todayTotalRate / (SHIFT_HOURS * 3600);
      liveToday = perSecondRate * secondsWorkedToday;
    }

    const progressDays = Math.min(todayCycleDay + 1, on);
    const progress = isWorkingToday ? (progressDays / on) * 100 : 100;

    let daysUntilBreak = 0;
    let daysUntilBack = 0;
    let nextReturnDate = null;

    if (isWorkingToday) {
      daysUntilBreak = Math.max(on - todayCycleDay - 1, 0);
      if (daysUntilBreak === 0) {
        nextReturnDate = new Date(now);
        nextReturnDate.setDate(now.getDate() + 1 + off);
      }
    } else {
      const offDayIndex = todayCycleDay - on;
      daysUntilBack = Math.max(off - offDayIndex - 1, 0);
      nextReturnDate = new Date(now);
      nextReturnDate.setDate(now.getDate() + daysUntilBack + 1);
    }

    const returnDayLabel = nextReturnDate
      ? nextReturnDate.toLocaleDateString("en-AU", { weekday: "long" })
      : null;

    const breakLabel = isWorkingToday
      ? daysUntilBreak === 0
        ? `R&R starts tomorrow · Back ${returnDayLabel}`
        : `${daysUntilBreak} day${daysUntilBreak === 1 ? "" : "s"} until break`
      : `Back ${returnDayLabel}${daysUntilBack >= 0 ? ` · ${daysUntilBack + 1} day${daysUntilBack + 1 === 1 ? "" : "s"}` : ""}`;

    const nextPayDate = new Date(PAYDAY_ANCHOR);
    while (nextPayDate <= now) nextPayDate.setDate(nextPayDate.getDate() + 14);
    const daysToNextPay = daysBetween(now, nextPayDate);

    return {
      casualRate,
      liveToday,
      swingEarnings,
      ytdEarnings,
      workedDays,
      progress,
      progressDays,
      isWorkingToday,
      daysUntilBreak,
      breakLabel,
      returnDayLabel,
      nextPayDate,
      daysToNextPay,
      on,
      off,
    };
  }, [afterTax, baseRate, casualUplift, lafha, now, roster, startDate, travel]);

  useEffect(() => {
    const target = derived.liveToday;
    const diff = target - displayValue;
    if (Math.abs(diff) < 0.01) {
      if (displayValue !== target) setDisplayValue(target);
      return;
    }
    const timeout = setTimeout(() => {
      setDisplayValue((prev) => prev + diff * 0.16);
    }, 40);
    return () => clearTimeout(timeout);
  }, [derived.liveToday, displayValue]);

  const currentMilestone = milestones.findLast((m) => derived.swingEarnings >= m) || null;

  useEffect(() => {
    if (!currentMilestone) return;
    const lastMilestone = localStorage.getItem("lastMilestone");
    if (String(currentMilestone) !== String(lastMilestone)) {
      setMilestoneFlash(currentMilestone);
      localStorage.setItem("lastMilestone", String(currentMilestone));
      const timeout = setTimeout(() => setMilestoneFlash(null), 3500);
      return () => clearTimeout(timeout);
    }
  }, [currentMilestone]);

  const onBreakNow = !derived.isWorkingToday;

  return (
    <div className="app-shell">
      <div className="app-container">
        <div className="header-block">
          <h1>Earnings Tracker</h1>
          <p>Live swing &amp; YTD earnings</p>
        </div>

        <section className="card settings-card">
          <div className="section-title neon-green">
            <Cog size={15} />
            <span>Settings</span>
          </div>

          <div className="tab-row">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-button ${activeTab === tab ? "tab-button--active" : ""}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="settings-divider" />

          <AnimatePresence mode="wait">
            {activeTab === "Schedule" && (
              <motion.div key="schedule" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="settings-panel">
                <div className="field-group">
                  <label>Roster</label>
                  <select value={roster} onChange={(e) => setRoster(e.target.value)} className="app-input">
                    {Object.keys(rosterOptions).map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={formatDateForInput(startDate)}
                    onChange={(e) => setStartDate(new Date(`${e.target.value}T00:00:00`))}
                    className="app-input"
                  />
                </div>

                <div className="toggle-row">
                  <div>
                    <div className="toggle-title">Show after tax</div>
                    <div className="toggle-subtitle">Allowances stay untaxed</div>
                  </div>
                  <button onClick={() => setAfterTax((v) => !v)} className={`toggle ${afterTax ? "toggle--active" : ""}`} aria-label="Toggle after tax">
                    <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }} className="toggle-thumb" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === "Rates" && (
              <motion.div key="rates" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="settings-panel">
                <div className="field-group">
                  <label>Base Rate</label>
                  <input type="number" value={baseRate} onChange={(e) => setBaseRate(Number(e.target.value))} className="app-input" />
                </div>

                <div className="field-group">
                  <label>Casual Uplift %</label>
                  <input type="number" value={casualUplift} onChange={(e) => setCasualUplift(Number(e.target.value))} className="app-input" />
                </div>

                <div className="info-box">
                  Casual formula: first 7.6 hours use base + casual uplift. Weekday overtime is 175% for 2 hours, then 225%. Saturdays are 175% for 2 hours then 225%. Sundays are 225% all day.
                </div>
              </motion.div>
            )}

            {activeTab === "Allowances" && (
              <motion.div key="allowances" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="settings-panel">
                <div className="field-group">
                  <label>Daily Travel Allowance</label>
                  <input type="number" value={travel} onChange={(e) => setTravel(Number(e.target.value))} className="app-input" />
                </div>

                <div className="field-group">
                  <label>LAFHA Allowance</label>
                  <input type="number" value={lafha} onChange={(e) => setLafha(Number(e.target.value))} className="app-input" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="card live-card">
          <div className="section-title neon-green">
            <span className="status-dot" />
            <span>{onBreakNow ? "Off Duty" : "On Duty"}</span>
          </div>

          <div className="live-value">{onBreakNow ? "—" : `$${formatMoney(displayValue, 2)}`}</div>
          <div className="live-subtext">{derived.breakLabel}</div>
        </section>

        <section className="card swing-card">
          <div className="swing-header-row">
            <div className="section-title neon-violet">
              <CalendarRange size={16} />
              <span>This Swing</span>
            </div>
            <div className="swing-days">{derived.progressDays}/{derived.on} days</div>
          </div>

          <div className="swing-value">${formatMoney(derived.swingEarnings, 2)}</div>
          <div className="progress-track">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${derived.progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </section>

        <section className="stats-grid">
          <StatCard
            icon={TrendingUp}
            label="YTD Earnings"
            value={`$${formatMoney(derived.ytdEarnings, 2)}`}
            subtext={`Casual $${formatMoney(derived.casualRate, 2)}/hr`}
            accentClass="accent-amber"
          />
          <StatCard icon={BriefcaseBusiness} label="Days Worked" value={String(derived.workedDays)} accentClass="accent-sky" />
          <StatCard
            icon={Gift}
            label={onBreakNow ? "Return Day" : "Days Until R&R"}
            value={onBreakNow ? (derived.returnDayLabel ? `Back ${derived.returnDayLabel}` : "On Break") : String(derived.daysUntilBreak)}
            accentClass="accent-pink"
          />
          <StatCard
            icon={Landmark}
            label="Next Payday"
            value={`${derived.daysToNextPay}d`}
            subtext={derived.nextPayDate.toDateString()}
            accentClass="accent-emerald"
          />
        </section>

        <section className="card milestones-card">
          <div className="section-title neon-green">
            <Sparkles size={15} />
            <span>Earnings Milestones</span>
          </div>
          <div className="milestone-row">
            {milestones.map((milestone) => (
              <MilestoneChip key={milestone} value={milestone} active={derived.swingEarnings >= milestone} />
            ))}
          </div>
        </section>

        <div className="footer-pill">
          <CalendarDays size={18} />
          <span>R&amp;R</span>
        </div>
      </div>

      <AnimatePresence>
        {milestoneFlash ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="milestone-popup"
          >
            <div className="section-title neon-green center-title">
              <Coins size={16} />
              <span>Milestone hit</span>
            </div>
            <div className="popup-value">${milestoneFlash.toLocaleString()}</div>
            <div className="popup-subtext">You’ve passed this swing target.</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
