type SectionSchema = {
  path: string
  requiredChildren: string[]
}

export const form910V27R133XsdMock: SectionSchema[] = [
  {
    path: 'F910.general',
    requiredChildren: [
      'tin',
      'name',
      'year',
      'period',
      'periodType',
      'isFirstDelivery',
      'incomeCode',
      'activityCodes',
      'version',
      'revision',
    ],
  },
  {
    path: 'F910.f910_00',
    requiredChildren: [
      'row1',
      'row2',
      'row3',
      'row4',
      'row5',
      'row6',
      'row7',
      'row8',
      'row9',
      'row10',
      'row11',
      'row12',
      'row13',
      'row14',
      'row15',
      'totalObligations',
    ],
  },
]

function sectionBody(xml: string, section: string): string {
  const match = new RegExp(`<${section}>\\s*([\\s\\S]*?)\\s*</${section}>`).exec(xml)
  if (!match) {
    throw new Error(`Missing required section: ${section}`)
  }

  return match[1]!
}

function elementValue(xml: string, element: string): string | null {
  const match = new RegExp(`<${element}>\\s*([\\s\\S]*?)\\s*</${element}>`).exec(xml)
  return match?.[1]?.trim() ?? null
}

export function validateAgainstMockForm910Xsd(xml: string): string[] {
  const errors: string[] = []

  if (!/<F910(?:\s[^>]*)?>[\s\S]*<\/F910>/.test(xml)) {
    errors.push('Missing required root element: F910')
  }

  for (const section of form910V27R133XsdMock) {
    const sectionName = section.path.split('.').at(-1)!
    let body = ''

    try {
      body = sectionBody(xml, sectionName)
    } catch (error) {
      errors.push((error as Error).message)
      continue
    }

    for (const child of section.requiredChildren) {
      const value = elementValue(body, child)
      if (value === null) {
        errors.push(`Missing mandatory field ${section.path}.${child}`)
      }
      if (value === '') {
        errors.push(`Mandatory field ${section.path}.${child} is empty`)
      }
    }

    if (section.path === 'F910.general') {
      try {
        const activityCodes = sectionBody(body, 'activityCodes')
        const activityCodeMatches = [...activityCodes.matchAll(/<activityCode>\s*([\s\S]*?)\s*<\/activityCode>/g)]
        if (activityCodeMatches.length === 0) {
          errors.push('Missing mandatory field F910.general.activityCodes.activityCode')
        }
        for (const match of activityCodeMatches) {
          if (!match[1]?.trim()) {
            errors.push('Mandatory field F910.general.activityCodes.activityCode is empty')
          }
        }
      } catch {
        // The parent activityCodes field is already reported by requiredChildren.
      }
    }

    const childPositions = section.requiredChildren.map((child) => ({
      child,
      index: body.search(new RegExp(`<${child}>`)),
    }))
    for (let i = 1; i < childPositions.length; i += 1) {
      const previous = childPositions[i - 1]!
      const current = childPositions[i]!
      if (previous.index !== -1 && current.index !== -1 && previous.index > current.index) {
        errors.push(`Field order mismatch in ${section.path}: ${previous.child} must precede ${current.child}`)
      }
    }
  }

  return errors
}
