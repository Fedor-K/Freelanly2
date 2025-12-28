/**
 * BLS (Bureau of Labor Statistics) API Client
 *
 * Uses OEWS (Occupational Employment and Wage Statistics) data
 * for US salary information by occupation and region.
 *
 * API Docs: https://www.bls.gov/developers/
 * OEWS Data: https://www.bls.gov/oes/
 */

const BLS_API_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

// BLS SOC (Standard Occupational Classification) codes for common tech jobs
// Full list: https://www.bls.gov/soc/2018/major_groups.htm
//
// IMPORTANT: Only add EXACT job title matches here. Do not add generic keywords.
// The matching is now conservative - we only match full phrases.
export const BLS_OCCUPATION_CODES: Record<string, { code: string; title: string }> = {
  // === Software Development (15-1252) ===
  'software engineer': { code: '15-1252', title: 'Software Developers' },
  'senior software engineer': { code: '15-1252', title: 'Software Developers' },
  'staff software engineer': { code: '15-1252', title: 'Software Developers' },
  'principal software engineer': { code: '15-1252', title: 'Software Developers' },
  'software developer': { code: '15-1252', title: 'Software Developers' },
  'senior software developer': { code: '15-1252', title: 'Software Developers' },
  'frontend developer': { code: '15-1252', title: 'Software Developers' },
  'frontend engineer': { code: '15-1252', title: 'Software Developers' },
  'backend developer': { code: '15-1252', title: 'Software Developers' },
  'backend engineer': { code: '15-1252', title: 'Software Developers' },
  'full stack developer': { code: '15-1252', title: 'Software Developers' },
  'fullstack developer': { code: '15-1252', title: 'Software Developers' },
  'full stack engineer': { code: '15-1252', title: 'Software Developers' },
  'fullstack engineer': { code: '15-1252', title: 'Software Developers' },
  'mobile developer': { code: '15-1252', title: 'Software Developers' },
  'ios developer': { code: '15-1252', title: 'Software Developers' },
  'android developer': { code: '15-1252', title: 'Software Developers' },

  // === Web Development (15-1254) ===
  'web developer': { code: '15-1254', title: 'Web Developers' },
  'wordpress developer': { code: '15-1254', title: 'Web Developers' },

  // === Data Science & ML (15-2051) ===
  'data scientist': { code: '15-2051', title: 'Data Scientists' },
  'senior data scientist': { code: '15-2051', title: 'Data Scientists' },
  'machine learning engineer': { code: '15-2051', title: 'Data Scientists' },
  'ml engineer': { code: '15-2051', title: 'Data Scientists' },
  'ai engineer': { code: '15-2051', title: 'Data Scientists' },

  // === Data Engineering & Databases (15-1243, 15-1242) ===
  'data engineer': { code: '15-1243', title: 'Database Architects' },
  'senior data engineer': { code: '15-1243', title: 'Database Architects' },
  'database administrator': { code: '15-1242', title: 'Database Administrators' },
  'dba': { code: '15-1242', title: 'Database Administrators' },

  // === Data Analysis (15-2041) - Different from Data Science ===
  'data analyst': { code: '15-2041', title: 'Statisticians' },
  'senior data analyst': { code: '15-2041', title: 'Statisticians' },
  'business intelligence analyst': { code: '15-2041', title: 'Statisticians' },

  // === DevOps & Infrastructure (15-1244) ===
  'devops engineer': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'senior devops engineer': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'sre': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'site reliability engineer': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'cloud engineer': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'platform engineer': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'infrastructure engineer': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'systems administrator': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'system administrator': { code: '15-1244', title: 'Network and Computer Systems Administrators' },
  'network administrator': { code: '15-1244', title: 'Network and Computer Systems Administrators' },

  // === Security (15-1212) ===
  'security engineer': { code: '15-1212', title: 'Information Security Analysts' },
  'cybersecurity engineer': { code: '15-1212', title: 'Information Security Analysts' },
  'information security analyst': { code: '15-1212', title: 'Information Security Analysts' },
  'security analyst': { code: '15-1212', title: 'Information Security Analysts' },

  // === QA & Testing (15-1253) ===
  'qa engineer': { code: '15-1253', title: 'Software Quality Assurance Analysts and Testers' },
  'quality assurance engineer': { code: '15-1253', title: 'Software Quality Assurance Analysts and Testers' },
  'test engineer': { code: '15-1253', title: 'Software Quality Assurance Analysts and Testers' },
  'sdet': { code: '15-1253', title: 'Software Quality Assurance Analysts and Testers' },
  'automation engineer': { code: '15-1253', title: 'Software Quality Assurance Analysts and Testers' },

  // === Network (15-1241) ===
  'network engineer': { code: '15-1241', title: 'Computer Network Architects' },
  'network architect': { code: '15-1241', title: 'Computer Network Architects' },

  // === IT Support (15-1232) ===
  'it support specialist': { code: '15-1232', title: 'Computer User Support Specialists' },
  'it support technician': { code: '15-1232', title: 'Computer User Support Specialists' },
  'help desk': { code: '15-1232', title: 'Computer User Support Specialists' },
  'technical support specialist': { code: '15-1232', title: 'Computer User Support Specialists' },
  'desktop support': { code: '15-1232', title: 'Computer User Support Specialists' },

  // === Data Entry & Annotation (43-9199) - LOW salary roles ===
  'data annotator': { code: '43-9199', title: 'Office and Administrative Support Workers, All Other' },
  'annotation specialist': { code: '43-9199', title: 'Office and Administrative Support Workers, All Other' },
  'data entry specialist': { code: '43-9021', title: 'Data Entry Keyers' },
  'data entry clerk': { code: '43-9021', title: 'Data Entry Keyers' },

  // === Design (27-1024) ===
  'ux designer': { code: '27-1024', title: 'Graphic Designers' },
  'ui designer': { code: '27-1024', title: 'Graphic Designers' },
  'ui/ux designer': { code: '27-1024', title: 'Graphic Designers' },
  'product designer': { code: '27-1024', title: 'Graphic Designers' },
  'graphic designer': { code: '27-1024', title: 'Graphic Designers' },
  'visual designer': { code: '27-1024', title: 'Graphic Designers' },

  // === Management (11-xxxx) ===
  'product manager': { code: '11-2021', title: 'Marketing Managers' },
  'senior product manager': { code: '11-2021', title: 'Marketing Managers' },
  'project manager': { code: '11-9199', title: 'Managers, All Other' },
  'senior project manager': { code: '11-9199', title: 'Managers, All Other' },
  'program manager': { code: '11-9199', title: 'Managers, All Other' },
  'engineering manager': { code: '11-3021', title: 'Computer and Information Systems Managers' },
  'cto': { code: '11-3021', title: 'Computer and Information Systems Managers' },
  'vp of engineering': { code: '11-3021', title: 'Computer and Information Systems Managers' },

  // === Business & Finance (13-xxxx) ===
  'business analyst': { code: '13-1111', title: 'Management Analysts' },
  'senior business analyst': { code: '13-1111', title: 'Management Analysts' },
  'financial analyst': { code: '13-2051', title: 'Financial Analysts' },
  'accountant': { code: '13-2011', title: 'Accountants and Auditors' },

  // === Marketing & Sales (11-2000, 41-0000) ===
  'marketing manager': { code: '11-2021', title: 'Marketing Managers' },
  'marketing specialist': { code: '13-1161', title: 'Market Research Analysts' },
  'sales representative': { code: '41-4012', title: 'Sales Representatives' },
  'account executive': { code: '41-4012', title: 'Sales Representatives' },
  'account manager': { code: '41-4012', title: 'Sales Representatives' },

  // === HR (13-1071, 11-3121) ===
  'hr manager': { code: '11-3121', title: 'Human Resources Managers' },
  'recruiter': { code: '13-1071', title: 'Human Resources Specialists' },
  'technical recruiter': { code: '13-1071', title: 'Human Resources Specialists' },
  'talent acquisition specialist': { code: '13-1071', title: 'Human Resources Specialists' },

  // === Writing & Content (27-3000) ===
  'content writer': { code: '27-3043', title: 'Writers and Authors' },
  'copywriter': { code: '27-3043', title: 'Writers and Authors' },
  'technical writer': { code: '27-3042', title: 'Technical Writers' },
  'editor': { code: '27-3041', title: 'Editors' },

  // === Customer Service (43-4051) ===
  'customer support specialist': { code: '43-4051', title: 'Customer Service Representatives' },
  'customer service representative': { code: '43-4051', title: 'Customer Service Representatives' },
  'customer success manager': { code: '43-4051', title: 'Customer Service Representatives' },
  'support specialist': { code: '43-4051', title: 'Customer Service Representatives' },
};

// OEWS series ID format: OEUM + area code + industry code + occupation code + data type
// National data: area = 0000000, industry = 000000
// Data type: 01 = employment, 04 = mean wage, 13 = annual mean wage

interface BLSResponse {
  status: string;
  responseTime: number;
  message: string[];
  Results: {
    series: Array<{
      seriesID: string;
      catalog?: {
        series_title: string;
        area: string;
        occupation: string;
      };
      data: Array<{
        year: string;
        period: string;
        periodName: string;
        value: string;
        footnotes: Array<{ code: string; text: string }>;
      }>;
    }>;
  };
}

export interface BLSSalaryData {
  occupation: string;
  occupationCode: string;
  annualMeanWage: number;
  hourlyMeanWage: number;
  employment: number;
  percentile10?: number;
  percentile25?: number;
  percentile50?: number;  // median
  percentile75?: number;
  percentile90?: number;
  area: string;
  year: string;
}

/**
 * Find BLS occupation code from job title
 *
 * CONSERVATIVE MATCHING: Only matches when we're confident about the occupation.
 * Returns null if unsure - the caller should fall back to category-based estimation.
 *
 * This prevents showing wrong market data (e.g., $130K for a $40K data entry job).
 */
export function findOccupationCode(jobTitle: string): { code: string; title: string } | null {
  const normalizedTitle = jobTitle.toLowerCase().trim();

  // Direct match only
  if (BLS_OCCUPATION_CODES[normalizedTitle]) {
    return BLS_OCCUPATION_CODES[normalizedTitle];
  }

  // Exact phrase match - the occupation name must appear as a complete phrase
  // Sort by length descending to match "software engineer" before "engineer"
  const sortedKeys = Object.keys(BLS_OCCUPATION_CODES).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    // Check if the key appears as a complete phrase at word boundaries
    const keyRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (keyRegex.test(normalizedTitle)) {
      return BLS_OCCUPATION_CODES[key];
    }
  }

  // NO KEYWORD FALLBACKS - they cause too many false positives
  // Examples of problems with keyword matching:
  // - "Data Annotator" matched to "data analyst" ($120K vs $40K actual)
  // - "AI Training Specialist" matched to "ai engineer" ($120K vs $50K actual)
  // - "Support Engineer" matched to "software engineer" ($130K vs $70K actual)
  //
  // Instead, return null and let the caller use category-based estimation

  return null;
}

/**
 * Build OEWS series ID for salary data
 * Format: OEUM + area(7) + industry(6) + occupation(6) + datatype(2)
 *
 * Data types:
 * 01 = Employment
 * 04 = Mean hourly wage
 * 13 = Annual mean wage
 * 07 = 10th percentile hourly
 * 08 = 25th percentile hourly
 * 09 = Median hourly
 * 10 = 75th percentile hourly
 * 11 = 90th percentile hourly
 */
function buildSeriesId(occupationCode: string, dataType: string, areaCode: string = '0000000'): string {
  // Remove dash from SOC code (15-1252 -> 151252) and pad to 6 digits
  const cleanOccCode = occupationCode.replace('-', '').padEnd(6, '0');
  const industryCode = '000000'; // All industries

  return `OEUM${areaCode}${industryCode}${cleanOccCode}${dataType}`;
}

/**
 * Fetch salary data from BLS API
 */
export async function fetchBLSSalary(
  jobTitle: string,
  state?: string
): Promise<BLSSalaryData | null> {
  const apiKey = process.env.BLS_API_KEY;

  const occupation = findOccupationCode(jobTitle);
  if (!occupation) {
    console.log(`[BLS] No occupation code found for: ${jobTitle}`);
    return null;
  }

  // Build series IDs for different data points
  const areaCode = '0000000'; // National level (TODO: add state-level later)
  const seriesIds = [
    buildSeriesId(occupation.code, '13', areaCode), // Annual mean wage
    buildSeriesId(occupation.code, '04', areaCode), // Hourly mean wage
    buildSeriesId(occupation.code, '01', areaCode), // Employment
  ];

  const currentYear = new Date().getFullYear();

  try {
    const payload: Record<string, unknown> = {
      seriesid: seriesIds,
      startyear: (currentYear - 2).toString(),
      endyear: currentYear.toString(),
      catalog: true,
      calculations: false,
      annualaverage: true,
    };

    if (apiKey) {
      payload.registrationkey = apiKey;
    }

    const response = await fetch(BLS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[BLS] API error: ${response.status}`);
      return null;
    }

    const data: BLSResponse = await response.json();

    if (data.status !== 'REQUEST_SUCCEEDED') {
      console.error(`[BLS] Request failed:`, data.message);
      return null;
    }

    // Parse results
    let annualMeanWage = 0;
    let hourlyMeanWage = 0;
    let employment = 0;
    let latestYear = '';

    for (const series of data.Results.series) {
      const latestData = series.data[0]; // Most recent data point
      if (!latestData) continue;

      const value = parseFloat(latestData.value);
      latestYear = latestData.year;

      if (series.seriesID.endsWith('13')) {
        annualMeanWage = value;
      } else if (series.seriesID.endsWith('04')) {
        hourlyMeanWage = value;
      } else if (series.seriesID.endsWith('01')) {
        employment = value;
      }
    }

    if (annualMeanWage === 0) {
      console.log(`[BLS] No wage data found for: ${jobTitle}`);
      return null;
    }

    // Estimate percentiles based on typical distribution
    // BLS doesn't always return percentiles, so we estimate
    const percentile25 = Math.round(annualMeanWage * 0.75);
    const percentile50 = Math.round(annualMeanWage * 0.95); // median typically slightly below mean
    const percentile75 = Math.round(annualMeanWage * 1.20);

    return {
      occupation: occupation.title,
      occupationCode: occupation.code,
      annualMeanWage: Math.round(annualMeanWage),
      hourlyMeanWage: Math.round(hourlyMeanWage * 100) / 100,
      employment: Math.round(employment),
      percentile25,
      percentile50,
      percentile75,
      percentile10: Math.round(annualMeanWage * 0.55),
      percentile90: Math.round(annualMeanWage * 1.50),
      area: 'National',
      year: latestYear,
    };

  } catch (error) {
    console.error('[BLS] Error fetching salary data:', error);
    return null;
  }
}
