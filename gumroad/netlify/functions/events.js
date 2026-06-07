exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { Allow: "POST" },
      body: JSON.stringify({ error: "method_not_allowed" })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "invalid_json" })
    };
  }

  const name = typeof payload.name === "string" ? payload.name.slice(0, 80) : "unknown";
  const path = typeof payload.path === "string" ? payload.path.slice(0, 200) : "";
  const timestamp = typeof payload.timestamp === "string" ? payload.timestamp.slice(0, 40) : new Date().toISOString();

  return {
    statusCode: 202,
    body: JSON.stringify({
      accepted: true,
      event: {
        name,
        path,
        timestamp
      }
    })
  };
};
