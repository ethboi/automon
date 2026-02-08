(function () {
  const e = React.createElement;

  function App() {
    const [snapshot, setSnapshot] = React.useState(null);
    const [status, setStatus] = React.useState("connecting");

    React.useEffect(() => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${protocol}://${window.location.host}`);

      ws.onopen = () => setStatus("live");
      ws.onclose = () => setStatus("disconnected");
      ws.onerror = () => setStatus("error");
      ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          if (payload.type === "snapshot") setSnapshot(payload.data);
        } catch (err) {
          console.error("bad ws payload", err);
        }
      };

      return () => ws.close();
    }, []);

    if (!snapshot) {
      return e("div", { className: "shell" }, e("div", { className: "card" }, "Waiting for world snapshot..."));
    }

    const state = snapshot.state;
    const trainerById = Object.fromEntries(state.trainers.map((t) => [t.id, t]));

    return e(
      "div",
      { className: "shell" },
      e(
        "div",
        { className: "header" },
        e("div", null, e("h1", { style: { margin: 0, fontSize: "22px" } }, "AutoMon Autonomous World"), e("div", { className: "small" }, `Tick ${state.tick} • Day ${state.day} • ${state.timeOfDay} • ${state.weather}`)),
        e("div", { className: status === "live" ? "badge" : "badge warn" }, status)
      ),
      e(
        "div",
        { className: "grid" },
        e(
          "section",
          { className: "card locations" },
          e("h2", null, "World Map / Positions"),
          snapshot.locationGraph.map((loc) => {
            const occupants = state.trainers.filter((t) => t.locationId === loc.id);
            return e(
              "div",
              { key: loc.id, className: "row" },
              e("div", null, e("strong", null, loc.name), " ", e("span", { className: "small" }, `(danger ${loc.dangerLevel})`)),
              e("div", null, occupants.map((o) => o.name).join(", ") || "-"),
            );
          })
        ),
        e(
          "section",
          { className: "card trainers" },
          e("h2", null, "Trainers + AutoMons"),
          state.trainers.map((t) =>
            e(
              "div",
              { key: t.id, style: { marginBottom: "10px", paddingBottom: "10px", borderBottom: "1px dashed #22323b22" } },
              e("div", null, e("strong", null, `${t.name}`), ` @ ${t.locationId}`),
              e("div", { className: "small" }, `HP ${t.health} | EN ${t.energy} | HU ${t.hunger} | Gold ${t.gold} | ELO ${t.elo}`),
              e(
                "div",
                { className: "small" },
                `Stable ${t.automons.length}/${t.stableCapacity}: `,
                t.automons.map((m) => `${m.nickname} Lv${m.level} (${m.health}/${m.maxHealth}, loy ${m.loyalty})`).join(" | ")
              )
            )
          )
        ),
        e(
          "section",
          { className: "card events" },
          e("h2", null, "Live Event Feed + Agent Reasoning"),
          state.events.slice(-18).reverse().map((ev, idx) =>
            e(
              "div",
              { className: "event", key: `${ev.tick}-${idx}` },
              e("div", null, `[${ev.tick}] ${ev.message}`),
              ev.reasoning ? e("div", { className: "reason" }, `Reasoning: ${ev.reasoning}`) : null
            )
          )
        ),
        e(
          "section",
          { className: "card market" },
          e("h2", null, "Market + Arena"),
          Object.entries(state.market.prices)
            .slice(0, 10)
            .map(([id, price]) => e("div", { key: id, className: "row" }, e("span", null, id), e("span", null, `${price}g (${state.market.trend[id]})`))),
          e("h2", { style: { marginTop: "12px" } }, "Leaderboard"),
          state.leaderboard.map((entry) => e("div", { key: entry.trainerId, className: "row" }, e("span", null, trainerById[entry.trainerId]?.name ?? entry.trainerId), e("span", null, entry.elo)))
        )
      )
    );
  }

  const root = ReactDOM.createRoot(document.getElementById("app"));
  root.render(e(App));
})();
