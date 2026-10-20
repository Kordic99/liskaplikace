import {z} from "zod";
export const themeIds=["dragon","autumn","forest","midnight"] as const;
export const preferencesSchema=z.object({themeId:z.enum(themeIds),showSticker:z.boolean(),revision:z.number().int().nonnegative()});
export type Preferences=z.infer<typeof preferencesSchema>;
export const defaultPreferences=():Preferences=>({themeId:"dragon",showSticker:true,revision:0});
export const themes=[
 {id:"dragon",name:"Dračí knihovna",description:"Vínová, zlato a strážce příběhů.",preview:"/images/theme-dragon-thumb.webp",colors:["#21151d","#71364a","#cfad76"],background:"#141214"},
 {id:"autumn",name:"Liščí podzim",description:"Živá liška v měděném podzimním lese.",preview:"/images/theme-autumn-fox-thumb.webp",colors:["#281c17","#a85b36","#e2b878"],background:"#1c1511"},
 {id:"forest",name:"Lesní útočiště",description:"Čítárna mezi kořeny a světlem luceren.",preview:"/images/theme-forest-refuge-thumb.webp",colors:["#15251f","#3f725b","#c0bd84"],background:"#101b16"},
 {id:"midnight",name:"Měsíční noc",description:"Malý princ, růže a nekonečné hvězdy.",preview:"/images/theme-moonlit-prince-thumb.webp",colors:["#181e35","#626b9e","#b9c8ed"],background:"#121622"},
] as const;
