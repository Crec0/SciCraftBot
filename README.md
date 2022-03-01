# TempBot
## A fork of [ScicraftBot](https://github.com/SciCraft/SciCraftBot) which is a fork of [EigenBot](https://github.com/commandblockguy/EigenBot)

### Original features

- Send a summary embed for minecraft issue links or on command. (https://bugs.mojang.com/browse/MC-4 or !MC-4 or /bug MC-4)
- Send embed on new minecraft release
- Restricting channels to specific type of media. Eg: Links only, Media only, etc
- Automatic twitch stream link deletion if stream has ended.

### Added features

- Converted to TypeScript for type safety
- ESLint for consistent formatting
- Includes pagination for batch issue request.
- Includes a consistent embed for issue reports.
- Keeps discord threads alive to bypass the usual thread auto close timer by discord.
