import {z} from "zod";
export const themeIds=["dragon","autumn","forest","midnight"] as const;
export const preferencesSchema=z.object({themeId:z.enum(themeIds),showSticker:z.boolean(),revision:z.number().int().nonnegative()});
export type Preferences=z.infer<typeof preferencesSchema>;
export const defaultPreferences=():Preferences=>({themeId:"dragon",showSticker:true,revision:0});
export const themes=[
 {id:"dragon",name:"Dračí knihovna",description:"Vínová, zlato a strážce příběhů.",colors:["#21151d","#71364a","#cfad76"],background:"#141214"},
 {id:"autumn",name:"Liščí podzim",description:"Teplá skořice, měď a podzimní večery.",colors:["#281c17","#a85b36","#e2b878"],background:"#1c1511"},
 {id:"forest",name:"Lesní útočiště",description:"Mechová zeleň a klid mezi stromy.",colors:["#15251f","#3f725b","#c0bd84"],background:"#101b16"},
 {id:"midnight",name:"Měsíční noc",description:"Inkoustová modř a stříbrný svit.",colors:["#181e35","#626b9e","#b9c8ed"],background:"#121622"},
] as const;
