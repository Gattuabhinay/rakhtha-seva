const body = {
  to: "gattu.abhinay333@gmail.com",
  subject: "Rakhtha Seva EMERGENCY template check",
  text: "Emergency match test. Template check OK.",
  html:
    '<div style="font-family:Georgia,serif"><h2 style="color:#8b1e1e">Rakhtha Seva · Emergency match</h2><p>Template check OK. Blood alert email path works.</p></div>',
};

fetch("http://localhost:5050/api/alert-status")
  .then((r) => r.json())
  .then((s) => {
    console.log("status", s);
    return fetch("http://localhost:5050/api/alert-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  })
  .then(async (r) => {
    const j = await r.json();
    console.log("email_http", r.status, j);
  })
  .catch((e) => console.error(e.cause?.code || e.message));
