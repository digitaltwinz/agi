import { useQuery } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { frontendSideFetch } from '~/common/util/clientFetchers';

import { patchSvgString } from './RenderCodeSVG';


export function heuristicIsBlockPlantUML(blockCode: string) {
  return (blockCode.startsWith('@startuml') && blockCode.endsWith('@enduml'))
    || (blockCode.startsWith('@startmindmap') && blockCode.endsWith('@endmindmap'))
    || (blockCode.startsWith('@startsalt') && blockCode.endsWith('@endsalt'))
    || (blockCode.startsWith('@startwbs') && blockCode.endsWith('@endwbs'))
    || (blockCode.startsWith('@startgantt') && blockCode.endsWith('@endgantt'));
}


export const diagramSx: SxProps = {
  textAlign: 'center',
  mx: 'auto',
  minHeight: 100,
};


// PlantUML -> SVG fetchers

export function usePlantUmlSvg(enabled: boolean, blockCode: string) {
  return useQuery({
    enabled,
    queryKey: ['plantuml', blockCode],
    queryFn: () => _fetchPlantUmlSvg(blockCode),
    staleTime: 24 * 60 * 60 * 1000, // 1 day
  });
}

export function getPlantUmlServerUrl(): string {
  // set at nextjs build time
  return process.env.NEXT_PUBLIC_PLANTUML_SERVER_URL || 'https://www.plantuml.com/plantuml/svg/';
}

async function _fetchPlantUmlSvg(plantUmlCode: string): Promise<string | null> {
  // Get the PlantUML server from inline env var
  let plantUmlServerUrl = getPlantUmlServerUrl();
  if (!plantUmlServerUrl.endsWith('/'))
    plantUmlServerUrl += '/';

  // fetch the PlantUML SVG
  let text: string = '';
  try {
    // Dynamically import the PlantUML encoder - it's a large library that slows down app loading
    const { encode: plantUmlEncode } = await import('plantuml-encoder');

    // retrieve and manually adapt the SVG, to remove the background
    const encodedPlantUML: string = plantUmlEncode(plantUmlCode);
    const response = await frontendSideFetch(`${plantUmlServerUrl}${encodedPlantUML}`);
    text = await response.text();
  } catch (error) {
    console.error('Error rendering PlantUML on server:', plantUmlServerUrl, error);
    return null;
  }

  // validate/extract the SVG
  const start = text.indexOf('<svg ');
  const end = text.indexOf('</svg>');
  if (start < 0 || end <= start)
    throw new Error('Could not render PlantUML');

  // remove the background color
  const svg = text
    .slice(start, end + 6) // <svg ... </svg>
    .replace('background:#FFFFFF;', '');

  // check for syntax errors
  if (svg.includes('>Syntax Error?</text>'))
    throw new Error('llm syntax issue (it happens!). Please regenerate or change the language model.');

  return svg;
}


export function RenderCodePlantUML(props: {
  svgCode: string | null;
  error: Error | null;
  fitScreen: boolean;
}) {
  return (
    <Box
      component='div'
      className='code-container'
      dangerouslySetInnerHTML={{
        __html: patchSvgString(props.fitScreen, props.svgCode) || (props.error ? `PlantUML Error: ${props.error.message}` : 'No PlantUML code'),
      }}
      sx={diagramSx}
    />
  );
}