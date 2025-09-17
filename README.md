# Blockza Directory MCP Server

A Model Context Protocol (MCP) server that provides access to the Blockza directory API, enabling AI assistants to search and retrieve information about companies, founders, and team members in the Blockza ecosystem.

## Features

### Resources
- **All Companies** (`blockza://companies`) - Complete directory of companies
- **Company Profile** (`blockza://company/{slug}`) - Detailed company information
- **Categories** (`blockza://categories`) - Available company categories
- **All Events** (`blockza://events`) - Complete directory of events
- **Event Details** (`blockza://event/{id}`) - Detailed event information
- **Upcoming Events** (`blockza://events/upcoming`) - Upcoming events only
- **Event Categories** (`blockza://events/categories`) - Available event categories
- **All Podcasts** (`blockza://podcasts`) - Complete list of podcasts
- **Podcast Details** (`blockza://podcast/{id}`) - Detailed podcast information
- **Podcast Categories** (`blockza://podcasts/categories`) - Available podcast categories

### Tools
- **search_companies** - Search companies by name, category, or criteria
- **get_company_details** - Get detailed information about a specific company
- **get_companies_by_category** - Retrieve companies in a specific category
- **get_team_members** - Get team member information for a company
- **get_directory_stats** - Get overall directory statistics
- **search_events** - Search events by title, category, or location
- **get_event_details** - Get detailed information about a specific event
- **get_events_by_category** - Retrieve events in a specific category
- **get_upcoming_events** - Get upcoming events
- **get_events_by_location** - Retrieve events by country/city
- **get_events_stats** - Get overall events statistics
- **search_podcasts** - Search podcasts by title, category, or company
- **get_podcast_details** - Get detailed information about a podcast
- **get_podcasts_by_category** - Retrieve podcasts in a specific category
- **get_podcasts_stats** - Get overall podcasts statistics

### Prompts
- **analyze_company** - Generate comprehensive company analysis
- **compare_companies** - Compare companies within the same category
- **analyze_event** - Generate comprehensive event analysis
- **compare_events** - Compare events by category or location
- **event_recommendations** - Generate event recommendations based on criteria

## Installation

1. **Clone and setup the project:**
```bash
# Create project directory
mkdir blockza-directory-mcp-server
cd blockza-directory-mcp-server

# Copy the provided files to your project directory
# - src/index.ts
# - package.json  
# - tsconfig.json
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
```bash
npm run build
```

## Configuration

### Claude Desktop Setup

1. **Find your Claude Desktop config file:**
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Add the server configuration:**
```json
{
  "mcpServers": {
    "blockza-directory": {
      "command": "node",
      "args": ["/absolute/path/to/your/blockza-directory-mcp-server/build/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/your/blockza-directory-mcp-server/` with the actual absolute path to your project directory.

3. **Restart Claude Desktop** to load the new server.

## Development

### Scripts
- `npm run build` - Build the TypeScript project
- `npm run dev` - Run in development mode with tsx
- `npm run watch` - Run in watch mode for development
- `npm run clean` - Clean build directory

### Testing the Server

You can test your MCP server using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector node build/index.js
```

This will open a web interface where you can test your tools, resources, and prompts.

## Usage Examples

Once configured in Claude Desktop, you can use natural language to interact with the Blockza directory:

### Search Companies
```
"Find all cryptocurrency exchanges in the Blockza directory"
"Search for AI companies that have affiliate programs"
"Show me verified companies with more than 100 views"
```

### Get Company Details
```
"Get detailed information about BitMart including team members"
"Tell me about Gynger's founder and business model"
"What are the social media links for BitMart?"
```

### Analysis and Insights
```
"Analyze BitMart's business model and competitive position"
"Compare all crypto exchanges in the directory"
"What are the statistics for the entire Blockza directory?"
```

## API Integration

The server integrates with the Blockza APIs:

- Directory: `https://api.blockza.io/api/directory`
- Events: `https://api.blockza.io/api/events`
- Podcasts: `https://api.blockza.io/api/podcasts`

- Companies: search/filter by category, details, team, stats
- Events: search/filter by category/location, upcoming, details, stats
- Podcasts: search/filter by category/company/status, details, stats

## Error Handling

The server includes comprehensive error handling for:
- Network failures
- API errors
- Invalid requests
- Missing data

All errors are properly logged and returned as structured responses.

## Security

- No API keys required for the public Blockza directory API
- All requests are read-only
- No sensitive data is stored locally
- Follows MCP security best practices

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Troubleshooting

### Common Issues

1. **Server not appearing in Claude Desktop:**
   - Check that the path in `claude_desktop_config.json` is absolute and correct
   - Ensure the build was successful (`npm run build`)
   - Restart Claude Desktop after configuration changes
   - Check Claude Desktop logs for any error messages

2. **Build errors:**
   - Ensure you have Node.js 18+ installed
   - Run `npm install` to install all dependencies
   - Check for TypeScript compilation errors

3. **Runtime errors:**
   - Check network connectivity to `https://api.blockza.io`
   - Verify the API endpoint is accessible
   - Check server logs for detailed error information

4. **Tool not responding:**
   - Verify the API is returning expected data format
   - Check for rate limiting from the API
   - Review error logs in the console

### Debug Mode

To run the server with verbose logging:
```bash
NODE_ENV=development npm run dev
```

### Manual Testing

Test individual API calls:
```bash
curl "https://api.blockza.io/api/directory"
```

## Support

For issues related to:
- **MCP Protocol**: [MCP Documentation](https://modelcontextprotocol.io)
- **Blockza API**: Contact Blockza support
- **This Server**: Create an issue in the project repository