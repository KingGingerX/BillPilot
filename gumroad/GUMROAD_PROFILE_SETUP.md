# Gumroad Profile Setup

Use this to make `https://tgbglobal.gumroad.com/` match the storefront positioning as closely as Gumroad's native profile editor allows.

Gumroad profile pages support profile settings, fonts/colors, pages, product sections, posts sections, subscribe sections, and text sections. The full custom HTML/CSS storefront in this repo should be deployed as a separate static site and linked to Gumroad for checkout.

## Profile Settings

Profile name:

```text
TGB Global
```

Short bio:

```text
Systems, operators, and automation built clean and deployed fast.
```

Recommended visual settings:

```text
Background: #0e1110
Text: #f5f3ec
Accent: #78c5b0
Secondary accent: #d9a45b
Style: dark, minimal, high-contrast, operator-grade
```

## Home Page Sections

Create these sections in this order:

1. Text section: `Operator-grade digital products`
2. Featured product section: your strongest Gumroad product
3. Product section: `Automation Systems`
4. Product section: `Builder Templates`
5. Product section: `Revenue Workflows`
6. Text section: `Buyer Proof`
7. Subscribe section: `Get the next TGB Global drop`
8. Text section: `Buyer Clarity`

## Text Section: Operator-grade digital products

Heading:

```text
TGB Global systems for builders who ship.
```

Body:

```text
Field-ready automation resources, launch assets, and revenue workflows built for people turning ideas into operating systems.

Start with the system that matches the job:

- Automation Systems: reduce repeated manual work and route execution cleanly.
- Builder Templates: launch, plan, position, and package faster.
- Revenue Workflows: package, sell, deliver, and improve digital offers.
- Creative Tools: build media, visuals, product packaging, and conversion assets.
```

Button:

```text
Browse Gumroad
```

## Product Section: Automation Systems

Section description:

```text
Workflow assets for reducing repeated manual work, routing execution, and building cleaner operating loops.
```

Suggested products:

```text
AdVelocity
Adforge
Affiliate Automation Engine
ApexCore
RevDaemon
```

## Product Section: Builder Templates

Section description:

```text
Reusable structures for launches, operations, planning, positioning, and product execution.
```

Suggested products:

```text
Passive Income Masterclass
Accounting Training Tool
Ad Agency Escape
Scriptbloc
```

## Product Section: Revenue Workflows

Section description:

```text
Practical assets for packaging, selling, delivering, and improving digital offers.
```

Suggested products:

```text
Revenue Sprint
Viral Threads
Affiliate Automation Engine
Passive Income Masterclass
```

## Text Section: Buyer Proof

Heading:

```text
What buyers are saying.
```

Body:

```text
★★★★★ Sarah Jenkins, Marketing Manager
"I've never seen results like this. The automation strategies alone doubled my client intake in three weeks."
Product: Revenue Sprint

★★★★★ Elena Rodriguez, Freelance Designer
"Finally, a course that doesn't just talk theory. I built my first digital asset in week two."
Product: Passive Income Masterclass

★★★★★ Jessica M., New Mom
"The intensity is perfect. I got my pre-baby body back faster than I thought possible."
Product: Alphagirl Workout

★★★★★ David Chen, E-commerce Owner
"Scaling used to be a nightmare. This system streamlined everything. Revenue is up 150%."
Product: Revenue Sprint

★★★★★ Miriam K., Teacher
"I needed a side hustle that didn't require me to be online 24/7. This masterclass delivered exactly that."
Product: Passive Income Masterclass

★★★★★ Tasha Williams, Personal Trainer
"Even as a pro, I was humbled by the programming. My endurance levels are at an all-time high."
Product: Alphagirl Workout
```

## Subscribe Section

Heading:

```text
Get the next TGB Global drop.
```

Button:

```text
Get updates
```

Description:

```text
Join the update list for new systems, Gumroad releases, and operator resources.
```

## Text Section: Buyer Clarity

Heading:

```text
Simple answers before checkout.
```

Body:

```text
Where do purchases happen?
Checkout, payment processing, file delivery, receipts, and account access are handled through Gumroad.

What is this best for?
Builders, operators, and creators who want practical digital systems for execution, automation, and product workflow.

How do I get support?
Use the seller contact options attached to the Gumroad purchase.

Where are product terms listed?
Each Gumroad offer is the source of truth for included files, updates, pricing, and refund details.
```

## Best Deployment Pattern

Use Gumroad as checkout and delivery.

Use the static site in `dist/` as the premium marketing page:

```text
Visitor -> hosted storefront -> Gumroad checkout
```

This preserves the full aesthetic while still letting Gumroad handle payment, delivery, receipts, and buyer accounts.
