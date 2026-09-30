this is a blog ---read it as see what u can learn to improve ui and ux:: Index
Family Values
8 July, 2024
Family is a self-custody crypto wallet for iOS that I’ve been working on for the past ~2 years.

It has been (very graciously, I might add!) praised for its unique feel and sensibilities. I've stumbled upon multiple recreations of Family's individual components for both mobile and even the web, many executed with exceptional skill.

Seeing this prompted me to sit down and try to share the essence behind Family, which is as much about connection and experience as it is about technology and design.

This is not a technical post or tutorial. There are many good resources about how to craft smooth animations or design pixel perfect UI, by people much smarter than I am.1

This is about how we made something complex feel welcoming. It’s about what makes Family feel familiar.

What makes Family, Family
The journey of developing Family led us to naturally form a set of guiding principles. These values emerged over time as we tackled the challenges of designing a new kind of crypto wallet. Throughout our team discussions and early iterations, we established three core principles: simplicity, fluidity, and delight.

Simplicity ensures accessibility, fluidity maintains continuity of experience, and delight fosters meaningful connections.

This approach is how we respect the user's time, intelligence, and experience. It's how we create an environment within Family where every interaction feels considered and worthwhile.

Simplicity
Many complex products often present all features at once, including crypto wallets. Everything is right there, all the time, whether you need it or not.

We wanted to take a different approach where the fundamentals would be at your fingertips, but everything else would appear as it became most relevant to you.

Our desire was to make Family accessible to newcomers without sacrificing depth or power for experienced users. This was particularly crucial for intricate flows like onboarding, which had many potential paths and edge cases. We wanted to avoid turning critical flows into daunting tasks and overwhelming the user.

Family has hundreds of potential paths, requiring intentional design to achieve simplicity.

Fluidity
We decided to focus on fluidity after observing how static transitions can disrupt the user’s sense of flow and orientation. Staticity can also leave a product feeling lifeless, which we didn’t want. A lifeless product feels like a dead product, and a dead product feels uncared for.

We didn’t plan to add motion for the sake of it, but rather to create a seamless journey through the entire app. We wanted each transition to feel like a natural progression, smoothly guiding the user from one point to the next.

Fluidity touches every interaction and component in Family.

Delight
Our team’s shared passion for designing enjoyable experiences meant that incorporating delightful moments into Family was a natural step. These moments can transform ordinary products into extraordinary ones.

Delight is of course subjective and styles may vary in creating these special touches. The important part is the deliberate effort to try and make something special at all.

❤️❤️❤️❤️❤️❤️❤️❤️
We previously worked on Honk, a real-time messaging app full of delight.

Building Family
With our key principles established, the challenge became tangibly incorporating them in Family.

What does a fluid interface look like in action? How do we ensure that delight is not just a buzzword, but a real feeling for everyone who uses Family?

Simplicity through gradual revelation
Our pursuit of simplicity led us to explore unique approaches to core navigation — maintaining a streamlined interface that is uncluttered yet powerful. After experimenting with various patterns, we arrived at our dynamic tray system.2

1x0.5x
Family's dynamic tray system comprises components housed within trays that can effortlessly expand, contract, and adapt in response to a user’s actions. Trays can appear on the fly and function as a condensed version of the app, with a specific set of constraints and capabilities.

1x0.5x
The tray system follows certain rules to function in a way that feels natural. Trays are initiated by the user by tapping buttons, icons, or opening push notifications. They can manifest either as standalone entities on top of any app content, or emerge from within other components like buttons.

1x0.5x
To prevent any confusion during transitions, each subsequent tray is designed to vary in height. This makes the progression or change unmistakably clear. This constraint occasionally requires us to rewrite content or tweak the design of a tray slightly to make a transition apparent.

1x0.5x
Every tray is equipped with a title that succinctly captures its function or contents, alongside an  icon. This icon serves a dual purpose: it allows users to dismiss the tray if it's the initial one shown, or navigate back through a sequence of trays that have been presented one-by-one.

1x0.5x
Each tray displayed is typically dedicated to a singular piece of content — like educational text explaining a feature — or a primary action, such as completing a checklist before a transaction.

1x0.5x
Finally, the tray's visual theme adapts to the current context — within a dark-themed flow, trays adopt a darker colour scheme.

1x0.5x
When deciding whether to implement a tray or full screen flow, we decided to utilise trays for transient actions that don't need to be permanently on display within the app.

This can be especially helpful for confirmation steps and warnings, which appear in the right place at the right time.

1x0.5x
Trays can also function as the starting point for more elaborate flows that ultimately transition to a full screen format.

1x0.5x
One advantage of leveraging trays over full screen flows is the preservation of context. Unlike full screen transitions that can displace users from where they just were, trays overlay content directly onto the current interface.

1x0.5x
This maintains a seamless connection between actions without removing users from their initial context.

For example, when a user initiates a swap approval, it unfolds from the swap interface itself. This kind of contextual continuity keeps the flow feeling integrated rather than disjointed. Even the tutorial shown to users the first time they use the feature is blended in.

1x0.5x
By encapsulating complex flows or information within compact, step-by-step trays, we distil overwhelming actions into manageable interactions.

The compact nature of trays signals to users that each task is approachable. It encourages engagement without the intimidation of a full screen commitment.

1x0.5x
Users are guided through actions with the reassurance that they're not veering off course, but rather diving deeper into their current context. This simplifies the user's journey and reinforces the fluidity and coherence of the overall experience.

1x0.5x
Our tray system is a staple throughout the Family app. It isn’t confined by the nature of the content within or the number of steps involved. Its versatility allows for any information or action to be shown, provided it maintains focus on a singular piece of information or action per tray.

1x0.5x
In many ways, the system mirrors aspects of the natural way we perceive our surroundings.

Imagine seeing parts of a room through an open doorway. From a few metres away, you’re able to catch a glimpse of what’s inside. As you approach and enter, the space and its contents are gradually revealed.

Each action by the user makes the interface unfold and evolve, much like walking through a series of interconnected rooms. As a user, I get to see where I’m going as I go there. It’s this dynamic that allows Family to remain simple and keep complexity out of sight and out of mind until required.

1x0.5x
In designing the dynamic tray system, our goal was not just to streamline the user interface but to acknowledge that users deserve an uncluttered and focused experience.

By presenting information and options as they become relevant, we respect the user's journey and cognitive load. We ensure that Family simplifies actions rather than complicates them.

Fluidity through seamless transitions
Our second principle builds upon similar themes to our dynamic tray system and pushes the concept even further. It envisions the entire app as a constantly evolving space, where any element can theoretically transform into another, given there's a strong enough rationale for the transition.

1x0.5x
My definition of a fluid interface is akin to moving through water — you float rather than walk through it. In practice, this means creating visible links between various screens, components, and features in a way that feels natural.

Each animation serves a purpose from an architectural perspective, aiding users in understanding their path from A → B.

1x0.5x
Similar to our tray system, we aim for a sense of dimensionality throughout the app. Our goal is to create a coherent journey that users are able to follow easily. Every movement feels like a logical step forward to resemble what we experience in physical spaces.

In Family, this concept of fluid transitions becomes apparent from the moment you begin onboarding.

As you move past the splash screen, you’re guided through multiple layers with an animation that moves a stack of cards to map out the journey.

This helps users grasp where they’re heading while also illustrating how choosing a different path could lead them in another direction. The app transforms in a way that avoids any sense of being lost.

1x0.5x
These fluid transitions in Family affect entire views and their success relies on us deeply understanding the app’s navigation. We need to know how and why a transition makes sense before adding it. We treat the app as having unbreakable physical rules when navigating its space.

1x0.5x
Many products default to static transitions, prioritising speed above all else. While speed is important, I believe applying motion thoughtfully can enhance clarity and feel just as fast.

For example, switching tabs in Family includes a flash of directional motion. If you tap on a tab on the left, the transition moves left, and vice versa for the right. This creates a subtle yet helpful sense of space and movement. We fly instead of teleport.

1x0.5x
This philosophy of ‘avoiding static transitions’ as I’ve often referred to it internally, can extend to even the smallest details.

Let’s take the transformation of a chevron in a multi-step flow; something that would typically be static.

In Family, we saw an opportunity when transitioning between screens for a simple but effective animation — from an  to a . This tiny detail, coupled with the broader view transition, clarifies the navigation action taken. Details such as this contribute to a sense of fluidity throughout the app and quickly compound over time.

1x0.5x
Applying this principle to text introduces yet another layer of fluidity.

We’re able to apply our approach to the transformation of button labels, like evolving 
 into 
. In a static interface, this change would happen instantly. This could leave the user unaware of the significant step they're about to take — in this case confirming a transaction.

To address this, we visually morph the text. This highlights the transition in a way that’s both noticeable and smooth.

1x0.5x
This effect is achieved through a system we created that leverages shared letters — such as the "Con" in both words. By animating the change, we reinforce the user's awareness of their action.

1x0.5x
We try to use text transformations whenever possible to improve interactions. Another example of this is adding wallets from an existing index. As the user adds more, the number and text displayed on the button adjust effortlessly.

1x0.5x
One effective way to ensure fluidity is to avoid redundant animations.

A pet peeve of mine is when a component already visible on the screen unnecessarily duplicates itself during an animation.

If a component occupies a space and will persist in the next phase of the user's journey, it should remain consistent.

As an example, the wallet cards within Family often move seamlessly between screens.

1x0.5x
This approach to continuity is consistently applied across Family.

You can see this in action on something as simple as our empty states. By keeping most of the text unchanged and constant when only a portion needs updating, we avoid the jarring effect of altering the whole sentence abruptly.

This is very similar to our Continue → Confirm transitions, but applied to any component that ‘travels' between screens.

1x0.5x
Crafting a fluid interface such as Family is the result of hundreds of small, deliberate decisions woven together. A single fluid transition, while worth adding, doesn't alone create a fluid interface.

This concept of fluidity goes hand in hand with our dynamic tray system. We’re able to create interactions of trays morphing into full screen views, buttons gliding across trays, buttons morphing into trays and back again, and so on. Every interaction feeds into the next.

1x0.5x
If reading all of this is making your head spin slightly, I can relate. Immersing ourselves in this idea was equally tedious at times. Achieving the level of fluidity we wanted demands a certain obsessiveness, but the effort pays off in the experience.

To really highlight the value added here, I went ahead and reduced the fluidity of certain interactions within Family purely for demonstration purposes (this wasn’t merged!).

Let's revisit our earlier example of the swap approval flow, where the tray emerges from within the swap interface itself. Here's a side-by-side comparison of the interaction with and without the added layer of fluidity.

1x0.5x
With the animation removed, the sense of connection is lost and the contextual continuity is gone. It’s not bad per-se, but it’s certainly not as good.

Another example is our wallet grouping feature, which allows users to quickly sort and view their wallet addresses by their associated seed phrases.

The addition of a simple animation, where addresses visually organise themselves into place, significantly enhances the user's understanding of what's happening.

Here’s a comparison with and without the animation.

1x0.5x
Without the animation, the action's intent and outcome become much less clear. The static approach feels like digital whiplash.

Price charts are another area where fluidity enhances the perception of speed. Instead of reducing motion in Family, I’ll use Cash App as a real contrasting example.

While Cash App is beautifully designed, integrating seamless movements in its price charts could make the app feel faster.

1x0.5x
Finally, let’s look at sending tokens. This is a core feature where understanding every action is crucial. Money is quite literally on the line.

We’ve seen how button labels smoothly transform, and this overarching concept of fluid motion is applied across all stages of the send flow.

It is particularly important as users progress from entering values to confirming them. This visual transition ensures users can see what’s happening between these screens. It gives them confidence that the amount entered is indeed the amount being sent.

Here’s a side-by-side comparison to illustrate the clear difference between the two versions.

1x0.5x
Even after the transaction is confirmed, a spinner moves into the bottom navigation to indicate where the user can now find their pending transaction on the activity tab.

1x0.5x
If the user takes further action on their pending transaction, those interactions continue to incorporate these same principles. Speeding up a transaction moves the speed up spinner to the original pending tray, to get across the idea that the speed up has been applied to the original transaction.

1x0.5x
These interactions aren't easy to create, but the seamless transitions within Family are more than just technical achievements. They're a manifestation of our respect for the user's sense of space and movement within the app.

As a user, there's a subconscious reassurance that comes with these fluid animations. Each motion suggests that the app is in tune with my intentions.

1x0.5x
In contrast, when my banking app displays a glitchy animation while accessing my checking account, it erodes my trust. It makes me question whether the app truly understands what I'm trying to do or if it can execute my actions accurately.

With Family, the consistent, smooth interactions communicate a clear message: "I know exactly what you need — let me get that for you…"

Fluidity is what makes sure users don’t feel lost or disoriented. It’s a commitment to comfort, clarity, and continuity.

Delight through selective emphasis
While simplicity and fluidity lay the groundwork, it's the carefully placed moments of delight that pave the way for emotional connection between the product and the user.

Delight is more than just adding fun interactions. It's about creating moments that resonate on a personal level — making software feel more human and responsive.

Through delight, we're able to show users that we value their emotional experience as much as their functional needs. Building a great product means respecting not just what someone does, but how they feel while doing it.

Placing equal value on every part of the app is important here. Users notice when parts of an app are less polished, which detracts from the overall experience. Therefore, our ability to introduce delight anywhere depends on achieving a consistent level of polish everywhere.

Many products neglect their less commonly used features.

This can make the entire product feel unpolished — like going to a fancy restaurant but finding it has a dirty bathroom.

Our aim is to ensure that every part of the app, regardless of how often it’s used, receives the same holistic design approach. Every interaction is a potential moment for delight.

One prime example of this is the process of setting up a new wallet — a significant, albeit infrequent action for most users. Many wallet apps overlook the potential here. They might streamline the process, but at the cost of making it feel mundane or glossing over the implications of what is happening. We chose to highlight its importance instead, crafting an interactive animation that marks the occasion and makes it memorable.

1x0.5x
I believe the key is carefully sprinkling these moments selectively throughout the app. Mastering delight is mastering selective emphasis. It’s about knowing where, when, and how to apply magical moments intentionally across a product.

We don’t intentionally diminish moments of delight in our less common features — we try to insert delight with varying degrees of ‘intensity’. This way, even our infrequently used features are never treated as an afterthought.

By focusing especially on elevating features that users might not encounter often, we can maximise the impact of delight through surprise and novelty.

Surprise can certainly play a key role, which is likely why easter eggs that users come across unexpectedly are often associated with delightful products.

We leverage the element of surprise in a few places, such as on the QR code screen in Family. The feature is used just enough to make an easter egg placed here enjoyable rather than annoying. In this instance, the magical moment is hidden in plain sight. When the user taps on the QR code, it triggers a gentle ripple effect.

1x0.5x
If users swipe their finger across, they reveal a sequin-like transformation of the dots. This discovery process is the surprise in both of these interactions, leading to the moment of delight.

1x0.5x
You could think of this as a ‘Delight-Impact Curve’,3 where the potential for delight increases as the frequency of feature usage decreases.

For features encountered less often, the opportunity to inject delight significantly enhances the user experience. For frequently used features, the value of adding further delight gradually diminishes.

While our frequently used features are always crafted to be inherently delightful, it's often the delight in the less utilised features that leave a more lasting impression.

Delight tends to increase as the frequency of feature usage decreases.

No matter the context, the ‘specialness of a moment' generally decreases with repeated encounters. Eating your favourite candy will get progressively less enjoyable with each piece, etc.

Let’s take a very commonly used feature as an example of where doing too much would quickly diminish potential delight.

As mentioned earlier, sending tokens is a core feature and something many users do daily. It’s therefore important for it to be efficient and enjoyable, without being overbearing.

Our approach here was to focus on the little things. In this case, the commas when inputting a number shift visually from place to place as the number is inputted.

1x0.5x
We also inserted an easter egg if the user enters an amount that exceeds their maximum balance, leveraging surprise once again.

1x0.5x
These tiny details do their job without becoming frustrating. This aligns with the 'Delight-Impact Curve' by adding just the right touch of delight to a frequently used feature.

Let’s look at a few more quick examples of less frequently used features within Family that have delightful moments inserted throughout.

When adding tokens or collectibles to the trash, they visually tumble into a skeuomorphic trash can.

Completing the action plays a satisfying sound effect.

1x0.5x
When using the in-app browser for the first time, users are greeted with an animated arrow in the empty state. This guides them towards creating a new tab and immediately makes the feature feel friendlier.

1x0.5x
By incorporating smooth drag-and-drop actions and attractive stacking animations, reordering tokens is a satisfying experience rather than a tedious one.

1x0.5x
Activating stealth mode is accompanied by a gentle shimmer effect when active. This effect signals that although your holdings' values are concealed, they continue to update discreetly in the background.

1x0.5x
Scrubbing through price charts visibly flips the arrow direction up or down alongside the changing numbers.

1x0.5x
After backing up your wallet successfully, confetti briefly fills the screen. This rewards the user for completing an essential security task.

1x0.5x
In all of these features, we're not just trying to entertain the user4. These moments are our way of valuing and rewarding the user's time and emotional investment in Family. They transform something mundane into something memorable.

The true value of Family lies in making every day interactions with the wallet a little easier, a little more seamless, and a lot more enjoyable. This philosophy shapes every aspect of the product.

It’s not just a tool but a familiar, friendly companion.

Family comes first
Adopting our core principles — simplicity, fluidity, and delight — meant making conscious trade-offs while building Family.

We prioritised creating a world-class experience, with the knowledge that it could slow down our pace to launch. Ultimately, our approach was essential to craft exactly what we wanted and give us the chance to stand out among the competition.

While simplicity, fluidity, and delight guided our creative process, we also committed to fundamental principles from the beginning. Utility, performance, security, and so on. These principles are table-stakes for any good product. Given their widely acknowledged importance, I focused on them less here, though they are equally vital to the product as a whole.

Truly great design transcends aesthetics — it creates a deeper bond between individuals and technology. Our lives are full of digital interactions and infusing these moments with some degree of magic feels essential — at least to me.

Despite the significant investment of time and resources required, creating experiences that deeply resonate with users is profoundly gratifying. Thoughtfully crafted software showcases a deep respect for the user.

Our ambition has always been to go above and beyond what someone might expect. That’s what Family is for.


Family is available on the App Store. Download on iOS.

Acknowledgements
Family is the result of countless individuals’ contributions over multiple years. The interactions in this post specifically are the exceptional work of Alex Vanderzon, Miles Vinson, Chris Lang, Benjamin Mayo, Stefano Demicheli, Julia Han, Kyle Howells, Benjamin Zweig, and Shaps Benkau.

Special thanks to the entire Family team (both past and present contributors) for bringing these principles to life beautifully.

Thanks to Jon-Kyle Mohr, Jason Yuan, Alex Vanderzon, Gavin Atkinson, Emil Kowalski, Yitong Zhang, Dennis Jin, Paco Coursey, and Lochie Axon for reading early drafts of this.

Footnotes
Emil Kowalski has an amazing course on crafting great animations for the web↩

Our tray system was inspired in part by Craft and their similar system.↩

Rauno Freiberg talks about a very similar concept of frequency and novelty in his great essay on interaction design.↩

Entertainment is of course a nice side effect. Plus, it has the power to turn an infrequent visit into a regular stop for users — just because they love that one delightful detail.↩

Family Values