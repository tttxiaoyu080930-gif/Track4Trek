export type SampleRouteDefinition = {
  id: string;
  assetPath: string;
  englishName: string;
  chineseName: string;
};

export const SAMPLE_ROUTES: readonly SampleRouteDefinition[] = [
  {
    id: "langta-cv",
    assetPath: "/samples/langta-cv.gpx",
    englishName: "Langta C+V",
    chineseName: "狼塔 C+V",
  },
  {
    id: "lingbai-route",
    assetPath: "/samples/lingbai-route.gpx",
    englishName: "Lingbai Route",
    chineseName: "灵白线",
  },
  {
    id: "wusun-ancient-trail",
    assetPath: "/samples/wusun-ancient-trail.gpx",
    englishName: "Wusun Ancient Trail",
    chineseName: "乌孙古道",
  },
  {
    id: "mount-wutai-circuit",
    assetPath: "/samples/mount-wutai-circuit.gpx",
    englishName: "Mount Wutai Circuit",
    chineseName: "五台山顺朝",
  },
  {
    id: "everest-east-slope",
    assetPath: "/samples/everest-east-slope.gpx",
    englishName: "Everest East Slope",
    chineseName: "珠峰东坡",
  },
] as const;
