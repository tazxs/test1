import type { PreferredLanguage } from '../types/user.types'

export type TaxLanguage = PreferredLanguage

type LocalizedText = Record<TaxLanguage, string>

export enum TaxTermKey {
  SoleProprietor = 'sole_proprietor',
  SimplifiedDeclarationRegime = 'simplified_declaration_regime',
  MRP = 'mrp',
  TaxDeclaration = 'tax_declaration',
  IndividualIncomeTax = 'individual_income_tax',
  SocialTax = 'social_tax',
  MandatoryPensionContributions = 'opv',
  MandatorySocialHealthInsurance = 'osms',
  GrossIncome = 'gross_income',
  TaxableIncome = 'taxable_income',
  TotalIncome = 'total_income',
  NonMonetaryIncome = 'non_monetary_income',
  MonetaryIncome = 'monetary_income',
  CalculatedTax = 'calculated_tax',
  TotalObligations = 'total_obligations',
  EmployeeCount = 'employee_count',
}

export interface TaxTerm extends LocalizedText {
  key: TaxTermKey
  aliases: readonly string[]
}

export const OFFICIAL_TAX_TERMS: Record<TaxTermKey, TaxTerm> = {
  [TaxTermKey.SoleProprietor]: {
    key:     TaxTermKey.SoleProprietor,
    kk:      'жеке кәсіпкер (ЖК)',
    ru:      'ИП (индивидуальный предприниматель)',
    en:      'sole proprietor (IP)',
    aliases: ['ИП', 'индивидуальный предприниматель', 'ЖК'],
  },
  [TaxTermKey.SimplifiedDeclarationRegime]: {
    key:     TaxTermKey.SimplifiedDeclarationRegime,
    kk:      'оңайлатылған декларация негізіндегі арнаулы салық режимі',
    ru:      'упрощенная декларация',
    en:      'simplified declaration special tax regime',
    aliases: ['Упрощенка', 'упрощенная декларация', 'Форма 910', 'Form 910'],
  },
  [TaxTermKey.MRP]: {
    key:     TaxTermKey.MRP,
    kk:      'АЕК',
    ru:      'МРП',
    en:      'MCI',
    aliases: ['МРП', 'АЕК', 'monthly calculation index'],
  },
  [TaxTermKey.TaxDeclaration]: {
    key:     TaxTermKey.TaxDeclaration,
    kk:      'салық декларациясы',
    ru:      'налоговая декларация',
    en:      'tax declaration',
    aliases: ['ФНО', 'декларация', 'форма налоговой отчетности'],
  },
  [TaxTermKey.IndividualIncomeTax]: {
    key:     TaxTermKey.IndividualIncomeTax,
    kk:      'Жеке табыс салығы',
    ru:      'индивидуальный подоходный налог',
    en:      'individual income tax',
    aliases: ['ИПН', 'IIT', 'индивидуальный подоходный налог', 'individual income tax'],
  },
  [TaxTermKey.SocialTax]: {
    key:     TaxTermKey.SocialTax,
    kk:      'әлеуметтік салық',
    ru:      'социальный налог',
    en:      'social tax',
    aliases: ['социальный налог', 'соцналог', 'social tax'],
  },
  [TaxTermKey.MandatoryPensionContributions]: {
    key:     TaxTermKey.MandatoryPensionContributions,
    kk:      'міндетті зейнетақы жарналары',
    ru:      'обязательные пенсионные взносы',
    en:      'mandatory pension contributions',
    aliases: ['ОПВ', 'пенсионные взносы', 'mandatory pension contributions'],
  },
  [TaxTermKey.MandatorySocialHealthInsurance]: {
    key:     TaxTermKey.MandatorySocialHealthInsurance,
    kk:      'міндетті әлеуметтік медициналық сақтандыру жарналары',
    ru:      'взносы на обязательное социальное медицинское страхование',
    en:      'mandatory social health insurance contributions',
    aliases: ['ОСМС', 'медицинское страхование', 'mandatory social health insurance'],
  },
  [TaxTermKey.GrossIncome]: {
    key:     TaxTermKey.GrossIncome,
    kk:      'жалпы кіріс',
    ru:      'валовый доход',
    en:      'gross income',
    aliases: ['gross income', 'валовый доход', 'жалпы кіріс'],
  },
  [TaxTermKey.TaxableIncome]: {
    key:     TaxTermKey.TaxableIncome,
    kk:      'салық салынатын кіріс',
    ru:      'налогооблагаемый доход',
    en:      'taxable income',
    aliases: ['taxable income', 'налогооблагаемый доход'],
  },
  [TaxTermKey.TotalIncome]: {
    key:     TaxTermKey.TotalIncome,
    kk:      'кірістердің жалпы сомасы',
    ru:      'общая сумма доходов',
    en:      'total income',
    aliases: ['total income', 'общая сумма доходов'],
  },
  [TaxTermKey.NonMonetaryIncome]: {
    key:     TaxTermKey.NonMonetaryIncome,
    kk:      'ақшалай емес нысандағы кіріс',
    ru:      'доход в неденежной форме',
    en:      'non-monetary income',
    aliases: ['non-monetary income', 'неденежный доход'],
  },
  [TaxTermKey.MonetaryIncome]: {
    key:     TaxTermKey.MonetaryIncome,
    kk:      'ақшалай нысандағы кіріс',
    ru:      'доход в денежной форме',
    en:      'monetary income',
    aliases: ['monetary income', 'денежный доход'],
  },
  [TaxTermKey.CalculatedTax]: {
    key:     TaxTermKey.CalculatedTax,
    kk:      'есептелген салық',
    ru:      'исчисленный налог',
    en:      'calculated tax',
    aliases: ['calculated tax', 'исчисленный налог'],
  },
  [TaxTermKey.TotalObligations]: {
    key:     TaxTermKey.TotalObligations,
    kk:      'міндеттемелердің жалпы сомасы',
    ru:      'общая сумма обязательств',
    en:      'total obligations',
    aliases: ['total obligations', 'общая сумма обязательств'],
  },
  [TaxTermKey.EmployeeCount]: {
    key:     TaxTermKey.EmployeeCount,
    kk:      'жұмыскерлер саны',
    ru:      'численность работников',
    en:      'employee count',
    aliases: ['employees', 'работники', 'жұмыскерлер'],
  },
}

export const OFFICIAL_TAX_TERMS_LIST: TaxTerm[] = Object.values(OFFICIAL_TAX_TERMS)

export enum DeclarationLabelKey {
  GeneratedMetadata = 'generated_metadata',
  GeneralSection = 'general_section',
  Form910Title = 'form_910_title',
  Form910Section = 'form_910_section',
  Form200Title = 'form_200_title',
  Form200Section = 'form_200_section',
  Tin = 'tin',
  TaxpayerName = 'taxpayer_name',
  ReportingYear = 'reporting_year',
  ReportingPeriod = 'reporting_period',
  PeriodType = 'period_type',
  FirstDelivery = 'first_delivery',
  Version = 'version',
  TotalDeductions = 'total_deductions',
}

export const DECLARATION_LABELS: Record<DeclarationLabelKey, LocalizedText> = {
  [DeclarationLabelKey.GeneratedMetadata]: {
    kk: 'Жасалған метадеректер',
    ru: 'Сгенерированные метаданные',
    en: 'Generated metadata',
  },
  [DeclarationLabelKey.GeneralSection]: {
    kk: 'Жалпы мәліметтер',
    ru: 'Общие сведения',
    en: 'General information',
  },
  [DeclarationLabelKey.Form910Title]: {
    kk: '910.00 нысаны - Шағын бизнес субъектілеріне арналған оңайлатылған декларация',
    ru: 'Форма 910.00 - Упрощенная декларация для субъектов малого бизнеса',
    en: 'Form 910.00 - Simplified declaration for small business entities',
  },
  [DeclarationLabelKey.Form910Section]: {
    kk: '910.00 бөлімі - Салықтарды және әлеуметтік төлемдерді есептеу',
    ru: 'Раздел 910.00 - Исчисление налогов и социальных платежей',
    en: 'Section 910.00 - Calculation of taxes and social payments',
  },
  [DeclarationLabelKey.Form200Title]: {
    kk: '200.00 нысаны - Жеке табыс салығы және әлеуметтік салық бойынша декларация',
    ru: 'Форма 200.00 - Декларация по индивидуальному подоходному налогу и социальному налогу',
    en: 'Form 200.00 - Individual income tax and social tax declaration',
  },
  [DeclarationLabelKey.Form200Section]: {
    kk: '200.00 бөлімі - Кірістер, шегерімдер және салықтар',
    ru: 'Раздел 200.00 - Доходы, вычеты и налоги',
    en: 'Section 200.00 - Income, deductions, and taxes',
  },
  [DeclarationLabelKey.Tin]: {
    kk: 'ЖСН/БСН',
    ru: 'ИИН/БИН',
    en: 'IIN/BIN',
  },
  [DeclarationLabelKey.TaxpayerName]: {
    kk: 'Салық төлеушінің атауы',
    ru: 'Наименование налогоплательщика',
    en: 'Taxpayer name',
  },
  [DeclarationLabelKey.ReportingYear]: {
    kk: 'Есепті жыл',
    ru: 'Отчетный год',
    en: 'Reporting year',
  },
  [DeclarationLabelKey.ReportingPeriod]: {
    kk: 'Есепті кезең',
    ru: 'Отчетный период',
    en: 'Reporting period',
  },
  [DeclarationLabelKey.PeriodType]: {
    kk: 'Кезең түрі',
    ru: 'Тип периода',
    en: 'Period type',
  },
  [DeclarationLabelKey.FirstDelivery]: {
    kk: 'Бастапқы табыс ету',
    ru: 'Первоначальное представление',
    en: 'Initial submission',
  },
  [DeclarationLabelKey.Version]: {
    kk: 'Нұсқа',
    ru: 'Версия',
    en: 'Version',
  },
  [DeclarationLabelKey.TotalDeductions]: {
    kk: 'Шегерімдердің жалпы сомасы',
    ru: 'Общая сумма вычетов',
    en: 'Total deductions',
  },
}

export function taxTerm(key: TaxTermKey | string, language: TaxLanguage): string {
  const term = OFFICIAL_TAX_TERMS[key as TaxTermKey]
  return term?.[language] ?? key
}

export function declarationLabel(key: DeclarationLabelKey, language: TaxLanguage): string {
  return DECLARATION_LABELS[key][language]
}

export function terminologyPromptBlock(language: TaxLanguage): string {
  const localized = OFFICIAL_TAX_TERMS_LIST
    .map((term) => `- ${term.aliases.join('/')} -> ${term[language]} (${term.ru}; ${term.en})`)
    .join('\n')

  return `OFFICIAL KAZAKHSTAN TAX TERMINOLOGY:
Use the user's language, but preserve familiar Russian/English terms when helpful.
When answering in Kazakh, prefer these official KGD-style terms:
${localized}`
}
