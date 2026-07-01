# mcp-geodistance

Geographic coordinate math MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1137+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `distance` | Great-circle (haversine) distance between two lat/lon points. Returns the distance in km, miles, nautical miles, meters & feet, plus the initial compass bearing from point 1 to point 2. |
| `destination` | Given a start lat/lon, a bearing (degrees) and a distance, compute the destination point. `unit` = km (default), mi, nmi, m or ft. |
| `dms_to_decimal` | Parse a degrees-minutes-seconds coordinate string to decimal degrees. Accepts forms like "40°26′46″N" or "40 26 46 N" or "-73.5". Returns the decimal value. |
| `decimal_to_dms` | Convert decimal lat/lon to degrees-minutes-seconds strings. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "geodistance": {
      "url": "https://gateway.pipeworx.io/geodistance/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1137+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Geodistance data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [All tools and guides](https://github.com/pipeworx-io/examples)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
