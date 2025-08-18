// src/index.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

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

class BlockzaAPIClient {
  private baseUrl = "https://api.blockza.io/api/directory";

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

// Register Tools
server.registerTool(
  "search_companies",
  {
    title: "Search Companies",
    description: "Search companies in the Blockza directory by name, category, or other criteria",
    inputSchema: {
      search: z.string().optional().describe("Search term to find companies by name or description"),
      category: z.string().optional().describe("Filter by company category (e.g., 'Crypto Exchanges', 'AI')"),
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
        name: company.name,
        slug: company.slug,
        category: company.category,
        shortDescription: company.shortDescription,
        founderName: company.founderName,
        verificationStatus: company.verificationStatus,
        url: company.url,
        likes: company.likes,
        views: company.views
      }));

      return {
        content: [{
          type: "text",
          text: `Found ${results.length} companies:\n\n${JSON.stringify(results, null, 2)}`
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
    description: "Retrieve all companies in a specific category",
    inputSchema: {
      category: z.string().describe("Category to filter by (e.g., 'Crypto Exchanges', 'AI')"),
      limit: z.number().optional().describe("Maximum number of results to return")
    }
  },
  async ({ category, limit }) => {
    try {
      const companies = await apiClient.getCompaniesByCategory(category);
      const results = limit ? companies.slice(0, limit) : companies;

      const summary = results.map(company => ({
        name: company.name,
        slug: company.slug,
        shortDescription: company.shortDescription,
        founderName: company.founderName,
        verificationStatus: company.verificationStatus,
        url: company.url,
        likes: company.likes,
        views: company.views
      }));

      return {
        content: [{
          type: "text",
          text: `Found ${results.length} companies in category "${category}":\n\n${JSON.stringify(summary, null, 2)}`
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
          text: JSON.stringify(teamInfo, null, 2)
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

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Blockza Directory MCP Server running on stdio");
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