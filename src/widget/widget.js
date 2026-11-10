import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
      const root = document.getElementById("blocks");
      const s = (v) => (v == null ? "" : String(v));
      const el = (tag, cls, text) => {
        const node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text !== undefined) node.textContent = s(text);
        return node;
      };
      const svg = (tag, attrs = {}) => {
        const node = document.createElementNS(
          "http://www.w3.org/2000/svg",
          tag,
        );
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, s(v));
        return node;
      };
      function chart(spec) {
        if (
          !spec ||
          !["bar", "line", "pie"].includes(spec.type) ||
          !Array.isArray(spec.data) ||
          !spec.data.length
        )
          throw Error("图表数据无效");
        const card = el("section", "card chart");
        if (spec.title) card.append(el("h3", "", spec.title));
        const data = spec.data.slice(0, 24),
          keys = Object.keys(data[0] || {}),
          xkey = spec.x || spec.name || keys[0],
          ykey =
            spec.y ||
            spec.value ||
            keys.find((k) => typeof data[0][k] === "number");
        const values = data.map((row) => Number(row[ykey]));
        if (values.some((v) => !Number.isFinite(v)))
          throw Error("图表数值无效");
        const view = svg("svg", {
          viewBox: "0 0 640 260",
          role: "img",
          "aria-label": s(spec.title || "数据图表"),
        });
        if (spec.type === "pie") {
          const total = values.reduce((a, b) => a + Math.max(0, b), 0);
          if (total <= 0) throw Error("饼图总值需大于零");
          let angle = -Math.PI / 2;
          values.forEach((v, i) => {
            const slice = (Math.max(0, v) / total) * Math.PI * 2,
              next = angle + slice,
              large = slice > Math.PI ? 1 : 0;
            const x1 = 180 + 100 * Math.cos(angle),
              y1 = 125 + 100 * Math.sin(angle),
              x2 = 180 + 100 * Math.cos(next),
              y2 = 125 + 100 * Math.sin(next);
            const p = svg("path", {
              d: `M180 125 L${x1} ${y1} A100 100 0 ${large} 1 ${x2} ${y2} Z`,
              fill: ["#7087ff", "#5cc7a0", "#f0b65a", "#d57bc1", "#6fc0df"][
                i % 5
              ],
            });
            view.append(p);
            angle = next;
            const label = svg("text", { x: 330, y: 40 + i * 22 });
            label.textContent = `${s(data[i][xkey])}  ${s(v)}${s(spec.unit)}`;
            view.append(label);
          });
        } else {
          const max = Math.max(1, ...values.map(Math.abs));
          for (let i = 0; i < 4; i++)
            view.append(
              svg("line", {
                class: "grid",
                x1: 42,
                x2: 626,
                y1: 20 + i * 65,
                y2: 20 + i * 65,
              }),
            );
          const step = 570 / data.length,
            points = [];
          data.forEach((row, i) => {
            const x = 50 + i * step + step / 2,
              y = 214 - (values[i] / max) * 185;
            points.push(`${x},${y}`);
            if (spec.type === "bar")
              view.append(
                svg("rect", {
                  class: "series",
                  x: x - Math.min(32, step * 0.35),
                  y,
                  width: Math.min(64, step * 0.7),
                  height: Math.max(0, 214 - y),
                  rx: 4,
                }),
              );
            const label = svg("text", { x, y: 240, "text-anchor": "middle" });
            label.textContent = s(row[xkey]).slice(0, 8);
            view.append(label);
          });
          if (spec.type === "line")
            view.append(
              svg("polyline", { class: "line", points: points.join(" ") }),
            );
        }
        card.append(view);
        return card;
      }
      function renderBlock(block) {
        switch (block.type) {
          case "metrics": {
            const wrap = el("div", "metrics");
            for (const item of block.items || []) {
              const c = el("article", "metric");
              c.append(
                el("span", "", item.label),
                el("strong", "", item.value),
              );
              if (item.delta) c.append(el("small", "", item.delta));
              wrap.append(c);
            }
            return wrap;
          }
          case "chart":
            return chart(block.chart || block);
          case "table": {
            const card = el("section", "card");
            if (block.title) card.append(el("h3", "", block.title));
            const table = el("table"),
              head = el("thead"),
              tr = el("tr");
            for (const c of block.columns || []) tr.append(el("th", "", c));
            head.append(tr);
            table.append(head);
            const body = el("tbody");
            for (const row of block.rows || []) {
              const r = el("tr");
              for (const cell of row) r.append(el("td", "", cell));
              body.append(r);
            }
            table.append(body);
            card.append(table);
            return card;
          }
          case "callout": {
            const c = el("aside", "callout");
            if (block.title) c.append(el("h3", "", block.title));
            c.append(el("p", "", block.text));
            return c;
          }
          case "timeline": {
            const list = el("ol", "timeline");
            for (const item of block.items || []) {
              const li = el("li");
              li.append(el("strong", "", item.title));
              if (item.date) li.append(el("time", "", item.date));
              if (item.description) li.append(el("p", "", item.description));
              list.append(li);
            }
            return list;
          }
          case "compare": {
            const wrap = el("div", "compare");
            for (const side of [block.left, block.right]) {
              const card = el("section");
              card.append(el("h4", "", side?.title));
              const list = el("ul");
              for (const item of side?.items || [])
                list.append(el("li", "", item));
              card.append(list);
              wrap.append(card);
            }
            return wrap;
          }
          case "code": {
            const card = el("div", "card");
            card.append(el("pre", "", block.code));
            return card;
          }
          case "divider":
            return el("hr", "divider");
          default:
            throw Error(`未知组件：${s(block.type)}`);
        }
      }
      const app = new App(
        { name: "chat-visualization", version: "0.1.0" },
        {},
        { autoResize: true },
      );
      app.ontoolresult = (result) => {
        root.replaceChildren();
        const blocks = result.structuredContent?.blocks;
        if (!Array.isArray(blocks)) {
          root.append(el("div", "callout", "工具结果缺少 blocks"));
          return;
        }
        for (const block of blocks) {
          try {
            root.append(renderBlock(block));
          } catch (error) {
            root.append(el("div", "callout", error.message));
          }
        }
        document.documentElement.dataset.rendered = "true";
      };
      void app.connect(new PostMessageTransport(window.parent, window.parent));
