import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.trim().startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      return [l.slice(0, i).trim(), v];
    }),
);

const status = await fetch("http://localhost:5050/api/alert-status").then((r) =>
  r.json(),
);
console.log("status", status);

const res = await fetch("http://localhost:5050/api/place-call", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    toPhone: "+918309030400",
    message:
      "Urgent blood request from Rakhtha Seva. Patient Ananya needs O negative at Care Hospitals Hyderabad. If you can donate, reply on WhatsApp or call the hospital blood bank.",
    lang: "en",
  }),
});
const data = await res.json();
console.log("call_http", res.status, data);
