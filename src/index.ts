// src/index.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as http from "http";
import * as url from "url";
import { randomUUID } from "node:crypto";

// Types based on your API response
interface SocialLinks {
  facebook: string;
  linkedin: string;
  telegram: string;
  twitter: string;
  youtube: string;
}

interface PromotionSettings {
  hasAffiliateProgram: boolean;
  interestedInBusinessPartnership: boolean;
}

interface TeamMember {
  _id: string;
  name: string;
  title: string;
  email: string;
  image: string;
  linkedinUrl: string;
  price: number;
  bookingMethods: string[];
  status: string;
  followers: number;
  responseRate: number;
}

interface Company {
  _id: string;
  name: string;
  slug: string;
  shortDescription: string;
  detail: string;
  category: string;
  logo: string;
  banner: string;
  founderName: string;
  founderDetails: string;
  founderEmail: string;
  founderImage: string;
  verificationStatus: string;
  url: string;
  isPromoted: boolean;
  likes: number;
  views: number;
  socialLinks: SocialLinks;
  promotionSettings: PromotionSettings;
  teamMembers: TeamMember[];
  createdAt: string;
  updatedAt: string;
  followerPrice: number;
  founderFollowers: number;
  founderResponseRate: number;
}

interface ApiResponse {
  success: boolean;
  data: Company[];
}

// Events API Types
interface EventSocialLinks {
  linkedin: string;
  telegram: string;
  twitter: string;
  instagram: string;
}

interface Event {
  _id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  country: string;
  city: string;
  eventStartDate: string;
  eventEndDate: string;
  category: string;
  website: string;
  featuredImage: string;
  socialLinks: EventSocialLinks;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

class BlockzaAPIClient {
  private baseUrl = "https://api.blockza.io/api/directory";
  private eventsUrl = "https://api.blockza.io/api/events";

  async getCompanies(params?: {
    limit?: number;
    category?: string;
    search?: string;
    verified?: boolean;
  }): Promise<ApiResponse> {
    try {
      const url = new URL(this.baseUrl);
      if (params?.limit) url.searchParams.set('limit', params.limit.toString());
      if (params?.category) url.searchParams.set('category', params.category);
      if (params?.search) url.searchParams.set('search', params.search);
      if (params?.verified !== undefined) url.searchParams.set('verified', params.verified.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getCompanyBySlug(slug: string): Promise<Company | null> {
    try {
      const data = await this.getCompanies({ search: slug });
      if (data.success && data.data.length > 0) {
        // Find exact match by slug
        const company = data.data.find(c => c.slug === slug);
        return company || data.data[0] || null; // Return exact match or first result
      }
      return null;
    } catch (error) {
      console.error('Failed to get company by slug:', error);
      return null;
    }
  }

  async getCompaniesByCategory(category: string): Promise<Company[]> {
    try {
      const data = await this.getCompanies({ category });
      return data.success ? data.data : [];
    } catch (error) {
      console.error('Failed to get companies by category:', error);
      return [];
    }
  }

  async getEvents(params?: {
    limit?: number;
    category?: string;
    search?: string;
    country?: string;
    city?: string;
    upcoming?: boolean;
  }): Promise<Event[]> {
    try {
      const url = new URL(this.eventsUrl);
      if (params?.limit) url.searchParams.set('limit', params.limit.toString());
      if (params?.category) url.searchParams.set('category', params.category);
      if (params?.search) url.searchParams.set('search', params.search);
      if (params?.country) url.searchParams.set('country', params.country);
      if (params?.city) url.searchParams.set('city', params.city);
      if (params?.upcoming !== undefined) url.searchParams.set('upcoming', params.upcoming.toString());

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Events API request failed:', error);
      throw error;
    }
  }

  async getEventById(id: string): Promise<Event | null> {
    try {
      const events = await this.getEvents();
      return events.find(event => event._id === id) || null;
    } catch (error) {
      console.error('Failed to get event by ID:', error);
      return null;
    }
  }

  async getEventsByCategory(category: string): Promise<Event[]> {
    try {
      return await this.getEvents({ category });
    } catch (error) {
      console.error('Failed to get events by category:', error);
      return [];
    }
  }

  async getUpcomingEvents(): Promise<Event[]> {
    try {
      const events = await this.getEvents();
      const now = new Date();
      return events.filter(event => new Date(event.eventStartDate) > now);
    } catch (error) {
      console.error('Failed to get upcoming events:', error);
      return [];
    }
  }

  async getEventsByLocation(country?: string, city?: string): Promise<Event[]> {
    try {
      return await this.getEvents({ country, city });
    } catch (error) {
      console.error('Failed to get events by location:', error);
      return [];
    }
  }
}

// Initialize API client
const apiClient = new BlockzaAPIClient();

// Create MCP server
const server = new McpServer({
  name: "blockza-directory",
  version: "1.0.0",
});

// Register Resources
server.registerResource(
  "companies",
  "blockza://companies",
  {
    title: "All Companies",
    description: "Complete directory of companies in the Blockza ecosystem",
    mimeType: "application/json"
  },
  async (uri) => {
    try {
      const data = await apiClient.getCompanies();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(data, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch companies: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

server.registerResource(
  "company-profile",
  new ResourceTemplate("blockza://company/{slug}", { list: undefined }),
  {
    title: "Company Profile",
    description: "Detailed profile information for a specific company"
  },
  async (uri, { slug }) => {
    try {
      if (typeof slug !== 'string') {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: "Invalid slug parameter" }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
      
      const company = await apiClient.getCompanyBySlug(slug);
      if (!company) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: `Company not found: ${slug}` }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(company, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch company: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

server.registerResource(
  "categories",
  "blockza://categories",
  {
    title: "Company Categories",
    description: "Available categories for filtering companies",
    mimeType: "application/json"
  },
  async (uri) => {
    try {
      const data = await apiClient.getCompanies();
      const categories = new Set<string>();
      
      if (data.success && data.data) {
        data.data.forEach(company => {
          if (company.category) {
            categories.add(company.category);
          }
        });
      }

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            success: true,
            categories: Array.from(categories).sort()
          }, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch categories: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

// Events Resources
server.registerResource(
  "events",
  "blockza://events",
  {
    title: "All Events",
    description: "Complete directory of events in the Blockza ecosystem",
    mimeType: "application/json"
  },
  async (uri) => {
    try {
      const events = await apiClient.getEvents();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(events, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch events: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

server.registerResource(
  "event-details",
  new ResourceTemplate("blockza://event/{id}", { list: undefined }),
  {
    title: "Event Details",
    description: "Detailed information for a specific event"
  },
  async (uri, { id }) => {
    try {
      if (typeof id !== 'string') {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: "Invalid event ID parameter" }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
      
      const event = await apiClient.getEventById(id);
      if (!event) {
        return {
          contents: [{
            uri: uri.href,
            text: JSON.stringify({ error: `Event not found: ${id}` }, null, 2),
            mimeType: "application/json"
          }]
        };
      }
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(event, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch event: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

server.registerResource(
  "upcoming-events",
  "blockza://events/upcoming",
  {
    title: "Upcoming Events",
    
    description: "All upcoming events in the Blockza ecosystem",
    mimeType: "application/json"
  },
  async (uri) => {
    try {
      const events = await apiClient.getUpcomingEvents();
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(events, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch upcoming events: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

server.registerResource(
  "event-categories",
  "blockza://events/categories",
  {
    title: "Event Categories",
    description: "Available categories for filtering events",
    mimeType: "application/json"
  },
  async (uri) => {
    try {
      const events = await apiClient.getEvents();
      const categories = new Set<string>();
      
      events.forEach(event => {
        if (event.category) {
          categories.add(event.category);
        }
      });

      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            success: true,
            categories: Array.from(categories).sort()
          }, null, 2),
          mimeType: "application/json"
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({ error: `Failed to fetch event categories: ${error}` }, null, 2),
          mimeType: "application/json"
        }]
      };
    }
  }
);

// Register Tools
server.registerTool(
  "search_companies",
  {
    title: "Search Companies by Name",
    description: "Search companies in the Blockza directory by name or general search terms. For category-specific searches, use get_companies_by_category instead.",
    inputSchema: {
      search: z.string().optional().describe("Search term to find companies by name or description"),
      category: z.string().optional().describe("Filter by company category (e.g., 'Crypto Exchanges', 'AI') - NOTE: For dedicated category searches, use get_companies_by_category tool"),
      limit: z.number().optional().describe("Maximum number of results to return"),
      verified_only: z.boolean().optional().describe("Show only verified companies")
    }
  },
  async ({ search, category, limit, verified_only }) => {
    try {
      // Filter out undefined values to satisfy exactOptionalPropertyTypes
      const params: {
        search?: string;
        category?: string;
        limit?: number;
        verified?: boolean;
      } = {};
      
      if (search !== undefined) params.search = search;
      if (category !== undefined) params.category = category;
      if (limit !== undefined) params.limit = limit;
      if (verified_only !== undefined) params.verified = verified_only;

      const data = await apiClient.getCompanies(params);

      if (!data.success) {
        return {
          content: [{
            type: "text",
            text: "Failed to search companies: API returned unsuccessful response"
          }],
          isError: true
        };
      }

      const companies = data.data || [];
      const results = companies.map(company => ({
        _id: company._id,
        name: company.name,
        slug: company.slug,
        category: company.category,
        shortDescription: company.shortDescription,
        logo: company.logo,
        banner: company.banner,
        founderName: company.founderName,
        verificationStatus: company.verificationStatus,
        url: company.url,
        likes: company.likes,
        views: company.views
      }));

      return {
        content: [{
          type: "text",
          text: `COMPANIES_DATA_START\n${JSON.stringify(results, null, 2)}\nCOMPANIES_DATA_END\n\nFound ${results.length} companies matching your search criteria.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching companies: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_company_details",
  {
    title: "Get Company Details",
    description: "Get detailed information about a specific company by slug or name",
    inputSchema: {
      identifier: z.string().describe("Company slug or name to look up"),
      include_team: z.boolean().optional().describe("Include team member information")
    }
  },
  async ({ identifier, include_team = false }) => {
    try {
      const company = await apiClient.getCompanyBySlug(identifier);
      
      if (!company) {
        return {
          content: [{
            type: "text",
            text: `Company not found: ${identifier}`
          }],
          isError: true
        };
      }

      const details = {
        basic_info: {
          name: company.name,
          slug: company.slug,
          category: company.category,
          shortDescription: company.shortDescription,
          detail: company.detail,
          logo: company.logo,
          banner: company.banner,
          url: company.url,
          verificationStatus: company.verificationStatus
        },
        founder: {
          name: company.founderName,
          details: company.founderDetails,
          email: company.founderEmail,
          image: company.founderImage,
          followers: company.founderFollowers,
          responseRate: company.founderResponseRate
        },
        social_links: company.socialLinks,
        promotion_settings: company.promotionSettings,
        stats: {
          likes: company.likes,
          views: company.views,
          followerPrice: company.followerPrice
        },
        ...(include_team && { team_members: company.teamMembers })
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(details, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting company details: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_companies_by_category",
  {
    title: "Get Companies by Category",
    description: "PRIMARY TOOL for retrieving all companies in a specific category. Use this tool when users ask for companies by category (Web3, NFT, Blockchain, AI, etc.). This provides the most comprehensive and accurate category-based results.",
    inputSchema: {
      category: z.string().describe("Category to filter by (e.g., 'Web3', 'NFT', 'Blockchain', 'Crypto Exchanges', 'AI', 'DeFi', 'Metaverse')"),
      limit: z.number().optional().describe("Maximum number of results to return")
    }
  },
  async ({ category, limit }) => {
    try {
      const companies = await apiClient.getCompaniesByCategory(category);
      const results = limit ? companies.slice(0, limit) : companies;

      const summary = results.map(company => ({
        _id: company._id,
        name: company.name,
        slug: company.slug,
        category: company.category,
        shortDescription: company.shortDescription,
        logo: company.logo,
        banner: company.banner,
        founderName: company.founderName,
        verificationStatus: company.verificationStatus,
        url: company.url,
        likes: company.likes,
        views: company.views
      }));

      return {
        content: [{
          type: "text",
          text: `COMPANIES_DATA_START\n${JSON.stringify(summary, null, 2)}\nCOMPANIES_DATA_END\n\nFound ${results.length} companies in category "${category}".`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting companies by category: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_team_members",
  {
    title: "Get Team Members",
    description: "Get team member information for a specific company",
    inputSchema: {
      company_slug: z.string().describe("Company slug to get team members for")
    }
  },
  async ({ company_slug }) => {
    try {
      const company = await apiClient.getCompanyBySlug(company_slug);
      
      if (!company) {
        return {
          content: [{
            type: "text",
            text: `Company not found: ${company_slug}`
          }],
          isError: true
        };
      }

      if (!company.teamMembers || company.teamMembers.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No team members found for ${company.name}`
          }]
        };
      }

      const teamInfo = {
        company: company.name,
        team_members: company.teamMembers.map(member => ({
          name: member.name,
          title: member.title,
          email: member.email,
          linkedin: member.linkedinUrl,
          image: member.image,
          status: member.status,
          followers: member.followers,
          responseRate: member.responseRate,
          price: member.price,
          bookingMethods: member.bookingMethods
        }))
      };

      return {
        content: [{
          type: "text",
          text: `TEAM_DATA_START\n${JSON.stringify(teamInfo, null, 2)}\nTEAM_DATA_END\n\nFound ${teamInfo.team_members.length} team members for ${teamInfo.company}.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting team members: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_directory_stats",
  {
    title: "Get Directory Statistics",
    description: "Get overall statistics about the Blockza directory",
    inputSchema: {}
  },
  async () => {
    try {
      const data = await apiClient.getCompanies();
      
      if (!data.success) {
        return {
          content: [{
            type: "text",
            text: "Failed to get directory statistics"
          }],
          isError: true
        };
      }

      const companies = data.data || [];
      const categories = new Set<string>();
      const verifiedCount = companies.filter(c => c.verificationStatus === 'verified').length;
      const promotedCount = companies.filter(c => c.isPromoted).length;
      const withAffiliateProgram = companies.filter(c => c.promotionSettings?.hasAffiliateProgram).length;
      const totalLikes = companies.reduce((sum, c) => sum + (c.likes || 0), 0);
      const totalViews = companies.reduce((sum, c) => sum + (c.views || 0), 0);

      companies.forEach(c => {
        if (c.category) categories.add(c.category);
      });

      const stats = {
        total_companies: companies.length,
        verified_companies: verifiedCount,
        promoted_companies: promotedCount,
        companies_with_affiliate_programs: withAffiliateProgram,
        total_categories: categories.size,
        categories: Array.from(categories).sort(),
        total_likes: totalLikes,
        total_views: totalViews,
        average_likes_per_company: companies.length > 0 ? (totalLikes / companies.length).toFixed(2) : 0,
        average_views_per_company: companies.length > 0 ? (totalViews / companies.length).toFixed(2) : 0
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting directory statistics: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Events Tools
server.registerTool(
  "search_events",
  {
    title: "Search Events",
    description: "Search events in the Blockza events directory by title, category, location, or other criteria",
    inputSchema: {
      search: z.string().optional().describe("Search term to find events by title, description, or company"),
      category: z.string().optional().describe("Filter by event category (e.g., 'Conference', 'Meetup')"),
      country: z.string().optional().describe("Filter by country"),
      city: z.string().optional().describe("Filter by city"),
      limit: z.number().optional().describe("Maximum number of results to return"),
      upcoming_only: z.boolean().optional().describe("Show only upcoming events")
    }
  },
  async ({ search, category, country, city, limit, upcoming_only }) => {
    try {
      const params: {
        search?: string;
        category?: string;
        country?: string;
        city?: string;
        limit?: number;
        upcoming?: boolean;
      } = {};
      
      if (search !== undefined) params.search = search;
      if (category !== undefined) params.category = category;
      if (country !== undefined) params.country = country;
      if (city !== undefined) params.city = city;
      if (limit !== undefined) params.limit = limit;
      if (upcoming_only !== undefined) params.upcoming = upcoming_only;

      const events = await apiClient.getEvents(params);
      
      let filteredEvents = events;
      if (upcoming_only) {
        const now = new Date();
        filteredEvents = events.filter(event => new Date(event.eventStartDate) > now);
      }

      const results = filteredEvents.map(event => ({
        id: event._id,
        title: event.title,
        company: event.company,
        category: event.category,
        location: `${event.city}, ${event.country}`,
        eventStartDate: event.eventStartDate,
        eventEndDate: event.eventEndDate,
        website: event.website,
        featuredImage: event.featuredImage
      }));

      return {
        content: [{
          type: "text",
          text: `EVENTS_DATA_START\n${JSON.stringify(results, null, 2)}\nEVENTS_DATA_END\n\nFound ${results.length} events matching your search criteria.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error searching events: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_event_details",
  {
    title: "Get Event Details",
    description: "Get detailed information about a specific event by ID",
    inputSchema: {
      event_id: z.string().describe("Event ID to look up")
    }
  },
  async ({ event_id }) => {
    try {
      const event = await apiClient.getEventById(event_id);
      
      if (!event) {
        return {
          content: [{
            type: "text",
            text: `Event not found: ${event_id}`
          }],
          isError: true
        };
      }

      const details = {
        basic_info: {
          id: event._id,
          title: event.title,
          company: event.company,
          category: event.category,
          description: event.description
        },
        location: {
          venue: event.location,
          city: event.city,
          country: event.country
        },
        dates: {
          start: event.eventStartDate,
          end: event.eventEndDate
        },
        links: {
          website: event.website,
          featuredImage: event.featuredImage
        },
        social_links: event.socialLinks,
        metadata: {
          createdAt: event.createdAt,
          updatedAt: event.updatedAt
        }
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(details, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting event details: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_events_by_category",
  {
    title: "Get Events by Category",
    description: "Retrieve all events in a specific category",
    inputSchema: {
      category: z.string().describe("Category to filter by (e.g., 'Conference', 'Meetup')"),
      limit: z.number().optional().describe("Maximum number of results to return")
    }
  },
  async ({ category, limit }) => {
    try {
      const events = await apiClient.getEventsByCategory(category);
      const results = limit ? events.slice(0, limit) : events;

      const summary = results.map(event => ({
        id: event._id,
        title: event.title,
        company: event.company,
        location: `${event.city}, ${event.country}`,
        eventStartDate: event.eventStartDate,
        eventEndDate: event.eventEndDate,
        website: event.website
      }));

      return {
        content: [{
          type: "text",
          text: `EVENTS_DATA_START\n${JSON.stringify(summary, null, 2)}\nEVENTS_DATA_END\n\nFound ${results.length} events in category "${category}".`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting events by category: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_upcoming_events",
  {
    title: "Get Upcoming Events",
    description: "Get all upcoming events sorted by date",
    inputSchema: {
      limit: z.number().optional().describe("Maximum number of results to return")
    }
  },
  async ({ limit }) => {
    try {
      const events = await apiClient.getUpcomingEvents();
      const results = limit ? events.slice(0, limit) : events;

      const summary = results.map(event => ({
        id: event._id,
        title: event.title,
        company: event.company,
        category: event.category,
        location: `${event.city}, ${event.country}`,
        eventStartDate: event.eventStartDate,
        eventEndDate: event.eventEndDate,
        website: event.website
      }));

      return {
        content: [{
          type: "text",
          text: `EVENTS_DATA_START\n${JSON.stringify(summary, null, 2)}\nEVENTS_DATA_END\n\nFound ${results.length} upcoming events.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting upcoming events: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_events_by_location",
  {
    title: "Get Events by Location",
    description: "Retrieve events in a specific country or city",
    inputSchema: {
      country: z.string().optional().describe("Country to filter by"),
      city: z.string().optional().describe("City to filter by"),
      limit: z.number().optional().describe("Maximum number of results to return")
    }
  },
  async ({ country, city, limit }) => {
    try {
      if (!country && !city) {
        return {
          content: [{
            type: "text",
            text: "Please provide either a country or city parameter"
          }],
          isError: true
        };
      }

      const events = await apiClient.getEventsByLocation(country, city);
      const results = limit ? events.slice(0, limit) : events;

      const summary = results.map(event => ({
        id: event._id,
        title: event.title,
        company: event.company,
        category: event.category,
        location: `${event.city}, ${event.country}`,
        eventStartDate: event.eventStartDate,
        eventEndDate: event.eventEndDate,
        website: event.website
      }));

      const location = city ? `${city}, ${country}` : country;
      return {
        content: [{
          type: "text",
          text: `EVENTS_DATA_START\n${JSON.stringify(summary, null, 2)}\nEVENTS_DATA_END\n\nFound ${results.length} events in ${location}.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting events by location: ${error}`
        }],
        isError: true
      };
    }
  }
);

server.registerTool(
  "get_events_stats",
  {
    title: "Get Events Statistics",
    description: "Get overall statistics about the Blockza events directory",
    inputSchema: {}
  },
  async () => {
    try {
      const events = await apiClient.getEvents();
      const upcomingEvents = await apiClient.getUpcomingEvents();
      
      const categories = new Set<string>();
      const countries = new Set<string>();
      const cities = new Set<string>();
      const companies = new Set<string>();

      events.forEach(event => {
        if (event.category) categories.add(event.category);
        if (event.country) countries.add(event.country);
        if (event.city) cities.add(event.city);
        if (event.company) companies.add(event.company);
      });

      const stats = {
        total_events: events.length,
        upcoming_events: upcomingEvents.length,
        past_events: events.length - upcomingEvents.length,
        total_categories: categories.size,
        categories: Array.from(categories).sort(),
        total_countries: countries.size,
        countries: Array.from(countries).sort(),
        total_cities: cities.size,
        cities: Array.from(cities).sort(),
        total_companies: companies.size,
        companies: Array.from(companies).sort()
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting events statistics: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Register Prompts
server.registerPrompt(
  "analyze_company",
  {
    title: "Analyze Company",
    description: "Generate a comprehensive analysis of a company in the directory",
    argsSchema: {
      company_slug: z.string().describe("The slug of the company to analyze")
    }
  },
  async ({ company_slug }) => {
    if (!company_slug) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please provide a company slug to analyze."
          }
        }]
      };
    }
    
    const company = await apiClient.getCompanyBySlug(company_slug);
    
    if (!company) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please provide an analysis template for when a company "${company_slug}" is not found in the directory.`
          }
        }]
      };
    }

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the following company from the Blockza directory:

Company: ${company.name}
Category: ${company.category}
Verification Status: ${company.verificationStatus}
Description: ${company.shortDescription}

Detailed Information:
${company.detail}

Founder: ${company.founderName}
Founder Details: ${company.founderDetails}

Social Presence:
- Website: ${company.url}
- Twitter: ${company.socialLinks.twitter}
- LinkedIn: ${company.socialLinks.linkedin}
- Telegram: ${company.socialLinks.telegram}
- Facebook: ${company.socialLinks.facebook}
- YouTube: ${company.socialLinks.youtube}

Business Information:
- Has Affiliate Program: ${company.promotionSettings.hasAffiliateProgram}
- Interested in Business Partnerships: ${company.promotionSettings.interestedInBusinessPartnership}
- Is Promoted: ${company.isPromoted}

Engagement Metrics:
- Likes: ${company.likes}
- Views: ${company.views}
- Founder Followers: ${company.founderFollowers}

Team Size: ${company.teamMembers?.length || 0} members

Please provide a comprehensive analysis covering:
1. Business overview and market position
2. Founder background and leadership
3. Social media presence and engagement
4. Growth potential and partnership opportunities
5. Competitive advantages
6. Any notable observations or recommendations`
        }
      }]
    };
  }
);

server.registerPrompt(
  "compare_companies",
  {
    title: "Compare Companies",
    description: "Generate a comparison between companies in the same category",
    argsSchema: {
      category: z.string().describe("Category to compare companies within"),
      limit: z.string().optional().describe("Number of companies to include in comparison (default: 5)")
    }
  },
  async ({ category, limit = "5" }) => {
    if (!category) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please provide a category to compare companies within."
          }
        }]
      };
    }

    const companies = await apiClient.getCompaniesByCategory(category);
    const numLimit = limit ? parseInt(limit, 10) : 5;
    const topCompanies = companies
      .sort((a, b) => (b.views + b.likes) - (a.views + a.likes))
      .slice(0, numLimit);

    if (topCompanies.length === 0) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `No companies found in category "${category}". Please suggest how to find companies in this category or recommend similar categories.`
          }
        }]
      };
    }

    const companyData = topCompanies.map(company => ({
      name: company.name,
      description: company.shortDescription,
      founder: company.founderName,
      verification: company.verificationStatus,
      engagement: { likes: company.likes, views: company.views },
      hasAffiliateProgram: company.promotionSettings.hasAffiliateProgram,
      teamSize: company.teamMembers?.length || 0,
      url: company.url
    }));

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please compare the following ${topCompanies.length} companies in the "${category}" category:

${JSON.stringify(companyData, null, 2)}

Please provide a detailed comparison covering:
1. Market positioning and unique value propositions
2. Founder backgrounds and leadership styles
3. User engagement and community presence
4. Business model differences
5. Partnership and growth opportunities
6. Competitive advantages and weaknesses
7. Recommendations for each company's improvement areas

Rank them by overall potential and explain your reasoning.`
        }
      }]
    };
  }
);

// Events Prompts
server.registerPrompt(
  "analyze_event",
  {
    title: "Analyze Event",
    description: "Generate a comprehensive analysis of an event in the directory",
    argsSchema: {
      event_id: z.string().describe("The ID of the event to analyze")
    }
  },
  async ({ event_id }) => {
    if (!event_id) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please provide an event ID to analyze."
          }
        }]
      };
    }
    
    const event = await apiClient.getEventById(event_id);
    
    if (!event) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Please provide an analysis template for when an event "${event_id}" is not found in the directory.`
          }
        }]
      };
    }

    const startDate = new Date(event.eventStartDate);
    const endDate = new Date(event.eventEndDate);
    const now = new Date();
    const isUpcoming = startDate > now;
    const isOngoing = startDate <= now && endDate >= now;

    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please analyze the following event from the Blockza events directory:

Event: ${event.title}
Organizer: ${event.company}
Category: ${event.category}
Status: ${isUpcoming ? 'Upcoming' : isOngoing ? 'Ongoing' : 'Past'}

Description:
${event.description}

Location: ${event.location}, ${event.city}, ${event.country}
Dates: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}

Links:
- Website: ${event.website}
- Featured Image: ${event.featuredImage}

Social Media:
- Twitter: ${event.socialLinks.twitter}
- LinkedIn: ${event.socialLinks.linkedin}
- Telegram: ${event.socialLinks.telegram}
- Instagram: ${event.socialLinks.instagram}

Please provide a comprehensive analysis covering:
1. Event overview and significance in the Web3 ecosystem
2. Organizer reputation and track record
3. Target audience and value proposition
4. Location and timing analysis
5. Social media presence and marketing strategy
6. Potential impact and networking opportunities
7. Recommendations for attendees or organizers
8. Market positioning and competitive landscape`
        }
      }]
    };
  }
);

server.registerPrompt(
  "compare_events",
  {
    title: "Compare Events",
    description: "Generate a comparison between events in the same category or location",
    argsSchema: {
      category: z.string().optional().describe("Category to compare events within"),
      location: z.string().optional().describe("Location to compare events within (country or city)"),
      limit: z.string().optional().describe("Number of events to include in comparison (default: 5)")
    }
  },
  async ({ category, location, limit = "5" }) => {
    if (!category && !location) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: "Please provide either a category or location to compare events within."
          }
        }]
      };
    }

    let events: Event[] = [];
    if (category) {
      events = await apiClient.getEventsByCategory(category);
    } else if (location) {
      // Try to determine if it's a country or city
      const allEvents = await apiClient.getEvents();
      events = allEvents.filter(event => 
        event.country.toLowerCase().includes(location.toLowerCase()) ||
        event.city.toLowerCase().includes(location.toLowerCase())
      );
    }

    const numLimit = limit ? parseInt(limit, 10) : 5;
    const topEvents = events
      .sort((a, b) => new Date(a.eventStartDate).getTime() - new Date(b.eventStartDate).getTime())
      .slice(0, numLimit);

    if (topEvents.length === 0) {
      const filterType = category || location;
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `No events found for "${filterType}". Please suggest how to find events in this category/location or recommend similar options.`
          }
        }]
      };
    }

    const eventData = topEvents.map(event => ({
      id: event._id,
      title: event.title,
      organizer: event.company,
      category: event.category,
      location: `${event.city}, ${event.country}`,
      venue: event.location,
      dates: {
        start: event.eventStartDate,
        end: event.eventEndDate
      },
      website: event.website,
      socialLinks: event.socialLinks
    }));

    const filterType = category || location;
    return {
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: `Please compare the following ${topEvents.length} events for "${filterType}":

${JSON.stringify(eventData, null, 2)}

Please provide a detailed comparison covering:
1. Event positioning and unique value propositions
2. Organizer reputation and expertise
3. Target audience and attendee benefits
4. Location advantages and accessibility
5. Timing and market conditions
6. Networking and business opportunities
7. Competitive advantages and potential challenges
8. Recommendations for attendees and organizers

Rank them by overall value and explain your reasoning.`
        }
      }]
    };
  }
);

server.registerPrompt(
  "event_recommendations",
  {
    title: "Event Recommendations",
    description: "Generate personalized event recommendations based on criteria",
    argsSchema: {
      interests: z.string().optional().describe("Areas of interest (e.g., 'DeFi', 'NFTs', 'AI')"),
      location: z.string().optional().describe("Preferred location (country or city)"),
      timeframe: z.string().optional().describe("Preferred timeframe (e.g., 'next 3 months', '2025')"),
      event_type: z.string().optional().describe("Type of event (e.g., 'Conference', 'Meetup', 'Hackathon')")
    }
  },
  async ({ interests, location, timeframe, event_type }) => {
    try {
      let events = await apiClient.getEvents();
      
      // Apply filters
      if (interests) {
        const interestTerms = interests.toLowerCase().split(',').map(term => term.trim());
        events = events.filter(event => 
          interestTerms.some(term => 
            event.title.toLowerCase().includes(term) ||
            event.description.toLowerCase().includes(term) ||
            event.category.toLowerCase().includes(term)
          )
        );
      }

      if (location) {
        events = events.filter(event => 
          event.country.toLowerCase().includes(location.toLowerCase()) ||
          event.city.toLowerCase().includes(location.toLowerCase())
        );
      }

      if (event_type) {
        events = events.filter(event => 
          event.category.toLowerCase().includes(event_type.toLowerCase())
        );
      }

      // Filter by timeframe
      if (timeframe) {
        const now = new Date();
        const threeMonthsFromNow = new Date(now.getTime() + (90 * 24 * 60 * 60 * 1000));
        const endOf2025 = new Date('2025-12-31');
        
        if (timeframe.toLowerCase().includes('next 3 months')) {
          events = events.filter(event => {
            const eventDate = new Date(event.eventStartDate);
            return eventDate >= now && eventDate <= threeMonthsFromNow;
          });
        } else if (timeframe.toLowerCase().includes('2025')) {
          events = events.filter(event => {
            const eventDate = new Date(event.eventStartDate);
            return eventDate <= endOf2025;
          });
        }
      }

      // Sort by date and take top 10
      const recommendations = events
        .sort((a, b) => new Date(a.eventStartDate).getTime() - new Date(b.eventStartDate).getTime())
        .slice(0, 10);

      const recommendationData = recommendations.map(event => ({
        id: event._id,
        title: event.title,
        organizer: event.company,
        category: event.category,
        location: `${event.city}, ${event.country}`,
        dates: event.eventStartDate,
        website: event.website,
        description: event.description.substring(0, 200) + '...'
      }));

      const criteria = [];
      if (interests) criteria.push(`Interests: ${interests}`);
      if (location) criteria.push(`Location: ${location}`);
      if (timeframe) criteria.push(`Timeframe: ${timeframe}`);
      if (event_type) criteria.push(`Event Type: ${event_type}`);

      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Based on your criteria: ${criteria.join(', ')}

I found ${recommendations.length} events that match your preferences:

${JSON.stringify(recommendationData, null, 2)}

Please provide personalized recommendations covering:
1. Why each event matches the user's criteria
2. Expected value and learning opportunities
3. Networking potential and target audience
4. Logistics and practical considerations
5. Alternative options if the top recommendations don't work
6. Tips for maximizing the event experience
7. Follow-up actions and preparation suggestions

Rank the recommendations by relevance and explain your reasoning.`
        }
      }]
    };
    } catch (error) {
      return {
        messages: [{
          role: "user",
          content: {
            type: "text",
            text: `Error generating event recommendations: ${error}. Please provide guidance on how to help users find relevant events.`
          }
        }]
      };
    }
  }
);


// Store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport | SSEServerTransport } = {};

// Start the server
async function main() {
  const PORT = process.env.PORT || 3001;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction || process.env.USE_HTTP === 'true') {
    // HTTP mode for production deployment with both StreamableHTTP and SSE support
    const httpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const parsedUrl = url.parse(req.url || '', true);
      
      // Handle CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }
      
      // Health check endpoint
      if (parsedUrl.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'healthy', 
          server: 'blockza-directory-mcp-server',
          tools: 12 // We have 12 tools defined
        }));
        return;
      }
      
      // MCP StreamableHTTP endpoint (modern bidirectional transport)
      if (parsedUrl.pathname === '/mcp') {
        try {
          let body = '';
          
          // Collect request body for POST requests
          if (req.method === 'POST') {
            req.on('data', chunk => {
              body += chunk.toString();
            });
            
            await new Promise<void>((resolve) => {
              req.on('end', resolve);
            });
          }
          
          const parsedBody = body ? JSON.parse(body) : undefined;
          const sessionId = req.headers['mcp-session-id'] as string;
          let transport: StreamableHTTPServerTransport;
          
          if (sessionId && transports[sessionId]) {
            // Check if the transport is of the correct type
            const existingTransport = transports[sessionId];
            if (existingTransport instanceof StreamableHTTPServerTransport) {
              transport = existingTransport;
            } else {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                jsonrpc: '2.0',
                error: {
                  code: -32000,
                  message: 'Bad Request: Session exists but uses a different transport protocol',
                },
                id: null,
              }));
              return;
            }
          } else if (!sessionId && req.method === 'POST' && parsedBody && isInitializeRequest(parsedBody)) {
            // Create new StreamableHTTP transport for initialization
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sessionId) => {
                console.log(`StreamableHTTP session initialized with ID: ${sessionId}`);
                transports[sessionId] = transport;
              }
            });
            
            // Set up onclose handler to clean up transport when closed
            transport.onclose = () => {
              const sid = transport.sessionId;
              if (sid && transports[sid]) {
                console.log(`Transport closed for session ${sid}, removing from transports map`);
                delete transports[sid];
              }
            };
            
            // Connect the transport to the MCP server
            await server.connect(transport);
          } else {
            // Invalid request
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'Bad Request: No valid session ID provided or not an initialization request',
              },
              id: null,
            }));
            return;
          }
          
          // Handle the request with the transport
          await transport.handleRequest(req, res, parsedBody);
          
        } catch (error) {
          console.error('Error handling MCP request:', error);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: {
                code: -32603,
                message: 'Internal server error',
              },
              id: null,
            }));
          }
        }
        return;
      }
      
      // Default response
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('MCP Server - Use /mcp for StreamableHTTP connection or /health for status');
    });
    
    httpServer.listen(PORT, () => {
      console.log(`Blockza Directory MCP Server running on HTTP port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
      console.log(`Transport: StreamableHTTP (bidirectional)`);
    });
  } else {
    // Stdio mode for local development and Claude Desktop
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Blockza Directory MCP Server running on stdio");
  }
}

// Handle process cleanup
process.on('SIGINT', async () => {
  console.error("Shutting down Blockza Directory MCP Server...");
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error("Shutting down Blockza Directory MCP Server...");
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});