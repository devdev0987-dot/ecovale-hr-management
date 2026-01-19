import { PF_WAGE_CEILING_MONTHLY, PF_EMPLOYEE_RATE, PF_EMPLOYER_RATE, ESI_EMPLOYEE_RATE, ESI_EMPLOYER_RATE, GRATUITY_RATE_ANNUAL } from './constants';

export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString;
  }
};

export const generateUniqueId = () => {
  return `id_${new Date().getTime()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateEmployeeId = (count: number) => {
  // Return a simple sequential numeric ID (1, 2, 3, ...)
  return String(count + 1);
};

export const validateEmail = (email: string) => {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
};

export const calculateSalaryFromCTC = (
  ctc: number,
  hraPercentage: number,
  conveyance: number,
  telephone: number,
  medicalAllowance: number,
  specialAllowance: number,
  includePF: boolean,
  includeESI: boolean,
  pt: number,
  tdsPercent: number
) => {
  // Recalculate salary components so that annual CTC matches provided `ctc`.
  // Rules:
  // - Basic = 50% of Annual CTC, monthly basic = (CTC * 0.5) / 12
  // - HRA = percentage of monthly basic
  // - Conveyance, Telephone, Medical are monthly amounts provided
  // - Special Allowance is the balancing monthly amount to match CTC after employer contributions (PF, ESI) and gratuity
  // - PF: 12% of basic (capped at PF_WAGE_CEILING_MONTHLY)
  // - ESI: employee 0.75% and employer 3.25% of gross when enabled
  // - Gratuity provision approximated as `GRATUITY_RATE_ANNUAL` of annual basic

  // constants imported from utils/constants

  const ctcAnnual = ctc;
  const ctcMonthly = ctcAnnual / 12;

  const basic = (ctcAnnual * 0.5) / 12; // monthly basic
  const hra = (basic * (hraPercentage || 0)) / 100;

  const conv = Number(conveyance) || 0;
  const tel = Number(telephone) || 0;
  const med = Number(medicalAllowance) || 0;

  // initial special allowance estimate (monthly)
  let special = Math.max(0, ctcMonthly - basic - hra - conv - tel - med);

  let employerPFMonthly = 0;
  let employeePFMonthly = 0;
  let esiEmployeeMonthly = 0;
  let esiEmployerMonthly = 0;
  let gratuityAnnual = 0;
  let tdsMonthly = 0;

  // iterate to balance CTC because employer contributions depend on gross which depends on special
  for (let i = 0; i < 10; i++) {
    const gross = basic + hra + conv + tel + med + special;
    const pfWage = Math.min(basic, PF_WAGE_CEILING_MONTHLY);
    employeePFMonthly = includePF ? pfWage * PF_EMPLOYEE_RATE : 0;
    employerPFMonthly = includePF ? pfWage * PF_EMPLOYER_RATE : 0;
    esiEmployeeMonthly = includeESI ? gross * ESI_EMPLOYEE_RATE : 0;
    esiEmployerMonthly = includeESI ? gross * ESI_EMPLOYER_RATE : 0;
    // only provide gratuity provision when both PF and ESI are included
    gratuityAnnual = (includePF && includeESI) ? basic * 12 * (GRATUITY_RATE_ANNUAL || 0) : 0;

    tdsMonthly = tdsPercent ? gross * (Number(tdsPercent) / 100) : 0;
    const ctcCalc = gross * 12 + employerPFMonthly * 12 + esiEmployerMonthly * 12 + gratuityAnnual;
    const diff = ctcAnnual - ctcCalc;
    if (Math.abs(diff) < 0.5) break;
    // adjust monthly special allowance by distributing the difference
    special += diff / 12;
    if (special < 0) { special = 0; break; }
  }

  // round special to 2 decimals and recompute final values
  special = Math.round(special * 100) / 100;
  const gross = basic + hra + conv + tel + med + special;
  const pfWage = Math.min(basic, PF_WAGE_CEILING_MONTHLY);
  employeePFMonthly = includePF ? pfWage * PF_EMPLOYEE_RATE : 0;
  employerPFMonthly = includePF ? pfWage * PF_EMPLOYER_RATE : 0;
  esiEmployeeMonthly = includeESI ? gross * ESI_EMPLOYEE_RATE : 0;
  esiEmployerMonthly = includeESI ? gross * ESI_EMPLOYER_RATE : 0;
  // only provide gratuity provision when both PF and ESI are included
  gratuityAnnual = (includePF && includeESI) ? basic * 12 * (GRATUITY_RATE_ANNUAL || 0) : 0;

  const calculatedPT = gross > 25000 ? 200 : 0;
  const professionalTax = pt || calculatedPT;

  // final monthly TDS/GST amounts
  tdsMonthly = tdsPercent ? gross * (Number(tdsPercent) / 100) : 0;
  // gst removed from final calculations

  const net = gross - employeePFMonthly - esiEmployeeMonthly - professionalTax - tdsMonthly;

  return {
    basic,
    hra,
    conveyance: conv,
    telephone: tel,
    medicalAllowance: med,
    specialAllowance: special,
    gross,
    pfDeduction: employeePFMonthly,
    employerPF: employerPFMonthly,
    esiDeduction: esiEmployeeMonthly,
    employerESI: esiEmployerMonthly,
    gratuityAnnual,
    tdsMonthly,
    professionalTax,
    net,
  };
};

export const calculateSalary = (basic: number, hra: number, da: number, medicalAllowance: number, performanceAllowance: number, specialAllowance: number, includePF: boolean, includeESI: boolean, pt: number, tds: number) => {
    const gross = basic + hra + da + medicalAllowance + performanceAllowance + specialAllowance;
    const pfDeduction = includePF ? basic * 0.12 : 0;
    const esiDeduction = (includeESI && gross < 21000) ? gross * 0.0075 : 0;
    const net = gross - pfDeduction - esiDeduction - pt - tds;
    return { gross, pfDeduction, esiDeduction, net };
};

export const computeCTC = (basic: number, gross: number, includePF: boolean) => {
  // gross assumed monthly; CTC = (gross * 12) + employerPFAnnual (if applicable)
  const annualGross = gross * 12;
  const employerPFAnnual = includePF ? basic * 0.12 * 12 : 0;
  const ctc = Math.round(annualGross + employerPFAnnual);
  return ctc;
};

/**
 * Compute detailed CTC breakdown (monthly + annual) including PF (employee + employer) and ESI.
 * Uses the same rules as `calculateSalaryFromCTC`:
 * - Monthly basic = CTC / 12
 * - PF wage = min(monthly basic, 15000)
 * - PF (employee) = 12% of PF wage
 * - Employer PF = 12% of PF wage (used as employer contribution toward CTC)
 * - ESI (employee) = 0.75% of gross if gross < 21000 (monthly)
 *
 * Parameters: `hraPercentage`, `conveyance`, `telephone`, `medicalAllowance`, `pt`, `tds` have sensible defaults.
 */
export const computeCTCBreakdown = (
  ctc: number,
  options?: {
    includePF?: boolean;
    includeESI?: boolean;
    hraPercentage?: number;
    conveyance?: number;
    telephone?: number;
    medicalAllowance?: number;
    pt?: number;
    tds?: number;
  }
) => {
  const {
    includePF = true,
    includeESI = false,
    hraPercentage = 10,
    conveyance = 0,
    telephone = 0,
    medicalAllowance = 0,
    pt = 0,
    tds = 0,
    } = options || {};

  // Reuse existing calculation which returns monthly components
  const salary = calculateSalaryFromCTC(
    ctc,
    hraPercentage,
    conveyance,
    telephone,
    medicalAllowance,
    0, // specialAllowance param is ignored by calculateSalaryFromCTC and recalculated
    includePF,
    includeESI,
    pt,
    tds
  );

  const monthly = {
    ctcMonthly: ctc / 12,
    basic: salary.basic,
    hra: salary.hra,
    conveyance: salary.conveyance,
    telephone: salary.telephone,
    medicalAllowance: salary.medicalAllowance,
    specialAllowance: salary.specialAllowance,
    gross: salary.gross,
    pfEmployee: salary.pfDeduction,
    pfEmployer: salary.employerPF,
    esiEmployee: salary.esiDeduction,
    esiEmployer: salary.employerESI,
    professionalTax: salary.professionalTax,
      tds: tds,
      tdsMonthly: salary.tdsMonthly,
    net: salary.net,
  };

  const annual = {
    ctcAnnual: ctc,
    grossAnnual: monthly.gross * 12,
    pfEmployeeAnnual: monthly.pfEmployee * 12,
    pfEmployerAnnual: monthly.pfEmployer * 12,
    esiEmployeeAnnual: monthly.esiEmployee * 12,
    esiEmployerAnnual: monthly.esiEmployer * 12,
    professionalTaxAnnual: monthly.professionalTax * 12,
      tdsAnnual: monthly.tds * 12,
    netAnnual: monthly.net * 12,
  };

  return { monthly, annual };
};

export const generateAnnexureBase64 = (name: string, salaryInfo: any) => {
  const lines = [] as string[];
  lines.push(`Annexure - Salary Breakdown for ${name}`);
  lines.push('');
  lines.push(`Basic (monthly): ${salaryInfo.basic}`);
  lines.push(`HRA (monthly): ${salaryInfo.hra}`);
  if (salaryInfo.conveyance !== undefined) lines.push(`Conveyance (monthly): ${salaryInfo.conveyance}`);
  if (salaryInfo.telephone !== undefined) lines.push(`Telephone (monthly): ${salaryInfo.telephone}`);
  if (salaryInfo.medicalAllowance !== undefined) lines.push(`Medical Allowance (monthly): ${salaryInfo.medicalAllowance}`);
  lines.push(`Special Allowance (monthly): ${salaryInfo.specialAllowance}`);
  lines.push(`Gross (monthly): ${salaryInfo.gross}`);
  lines.push(`Net (monthly): ${salaryInfo.net}`);
  if (salaryInfo.pfDeduction !== undefined) lines.push(`Employee PF (monthly): ${salaryInfo.pfDeduction}`);
  if (salaryInfo.employerPF !== undefined) lines.push(`Employer PF (monthly): ${salaryInfo.employerPF}`);
  if (salaryInfo.esiDeduction !== undefined) lines.push(`Employee ESI (monthly): ${salaryInfo.esiDeduction}`);
  if (salaryInfo.employerESI !== undefined) lines.push(`Employer ESI (monthly): ${salaryInfo.employerESI}`);
  if (salaryInfo.gratuityAnnual !== undefined) lines.push(`Gratuity provision (annual): ${salaryInfo.gratuityAnnual}`);
  if (salaryInfo.tds !== undefined) lines.push(`TDS (%): ${salaryInfo.tds}`);
  if (salaryInfo.tdsMonthly !== undefined) lines.push(`TDS (monthly): ${salaryInfo.tdsMonthly}`);
  if (salaryInfo.gstMonthly !== undefined) lines.push(`GST (monthly): ${salaryInfo.gstMonthly}`);
  if (salaryInfo.gstAnnual !== undefined) lines.push(`GST (annual): ${salaryInfo.gstAnnual}`);
  if (salaryInfo.ctc !== undefined && salaryInfo.gstAnnual !== undefined) lines.push(`Total (CTC + GST) (annual): ${Number(salaryInfo.ctc) + Number(salaryInfo.gstAnnual)}`);
  if (salaryInfo.ctc !== undefined && salaryInfo.gstAnnual !== undefined) lines.push(`Total (CTC + GST) (monthly): ${((Number(salaryInfo.ctc) + Number(salaryInfo.gstAnnual)) / 12).toFixed(2)}`);
  if (salaryInfo.professionalFeesMonthly !== undefined) lines.push(`Professional Fees (monthly): ${salaryInfo.professionalFeesMonthly}`);
  if (salaryInfo.professionalFeesInclusive !== undefined) lines.push(`Professional Fees inclusive flag: ${salaryInfo.professionalFeesInclusive}`);
  if (salaryInfo.professionalFeesMonthly !== undefined) lines.push(`Professional Fees (annual): ${Number(salaryInfo.professionalFeesMonthly) * 12}`);
  if (salaryInfo.ctc) lines.push(`CTC (annual): ${salaryInfo.ctc}`);
  lines.push('');
  lines.push('This annexure is generated automatically by EcoVale HR.');

  const text = lines.join('\n');
  // encode to base64 safely
  const utf8 = encodeURIComponent(text);
  const base64 = btoa(unescape(utf8));
  return `data:text/plain;base64,${base64}`;
};

export const generateAppointmentLetterBase64 = (
  employeeName: string,
  designation: string,
  salaryInfo: any,
  joinDate?: string,
  additionalTerms?: string
) => {
  const lines: string[] = [];
  lines.push('EcoVale Technologies Pvt. Ltd.');
  lines.push('hegganahalli cross, Bangalore - 560001');
  lines.push('');
  lines.push(`Date: ${formatDate(joinDate || new Date().toISOString())}`);
  lines.push('');
  lines.push(`Subject: Appointment Letter - ${designation}`);
  lines.push('');
  lines.push(`Dear ${employeeName},`);
  lines.push('');
  lines.push(`We are pleased to confirm your appointment as ${designation} at EcoVale Technologies Pvt. Ltd.`);
  if (salaryInfo) {
    lines.push('');
    lines.push('Compensation:');
    if (salaryInfo.ctc) lines.push(`- CTC (annual): ${salaryInfo.ctc}`);
    if (salaryInfo.gross) lines.push(`- Gross (monthly): ${salaryInfo.gross}`);
    if (salaryInfo.net) lines.push(`- Net (monthly, approx): ${salaryInfo.net}`);
    if (salaryInfo.basic !== undefined) lines.push(`- Basic (monthly): ${salaryInfo.basic}`);
    if (salaryInfo.hra !== undefined) lines.push(`- HRA (monthly): ${salaryInfo.hra}`);
  }

  if (joinDate) lines.push(``), lines.push(`Your appointment will commence on ${formatDate(joinDate)}.`);
  lines.push('');
  lines.push('Terms of Employment:');
  lines.push('- This appointment is subject to company policies and background verification.');
  if (additionalTerms) {
    lines.push('');
    lines.push('Additional Terms:');
    lines.push(additionalTerms);
  }
  lines.push('');
  lines.push('Please sign and return a copy of this letter to indicate your acceptance.');
  lines.push('');
  lines.push('Sincerely,');
  lines.push('HR Department');
  lines.push('EcoVale Technologies Pvt. Ltd.');

  const text = lines.join('\n');
  const utf8 = encodeURIComponent(text);
  const base64 = btoa(unescape(utf8));
  return `data:text/plain;base64,${base64}`;
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};
