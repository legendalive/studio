SwingMatrix is a scenario engine for Kenyan elections. It combines coalition game theory with statistical simulation so the person using it moves the assumptions themselves and watches the projected outcome move with them. It is being built for the current election season.

:::warn
SwingMatrix is in development. Nothing on this page is a forecast, a poll or a result. The repository exists and the model specification is being written. No projections are published yet.
:::

## The question it answers

Election coverage usually offers a single number with the assumptions buried underneath it. SwingMatrix takes the opposite position: the assumptions are the interface. Every projection is attached to the inputs that produced it, so two people who disagree can find the exact variable they disagree about instead of arguing about the headline.

## Who it is for

- **Campaigns and strategists.** Test where a coalition holds, where it is fragile, and which regions decide the outcome.
- **Researchers and political scientists.** Run controlled scenarios, inspect sensitivity, and export a method along with the numbers.
- **Students and teachers.** See coalition arithmetic and uncertainty behave under changes they make themselves, rather than reading a static result.

## The model, in four layers

1. **Electorate base.** Registered voters by county and constituency, drawn from published aggregate figures. This is the denominator everything else sits on.
2. **Turnout.** Propensity by cohort and region, so the model distinguishes the people who are registered from the people who actually vote.
3. **Coalition game.** Parties are treated as players choosing whether to run alone or together. Payoffs come from seat share and office, and the engine looks for configurations that are stable, meaning no player gains by defecting. Fragile majorities are reported as fragile.
4. **Simulation.** Thousands of seeded runs over the uncertain inputs produce a distribution rather than a single number, with intervals and a ranking of which variables moved the result most.

## The variables on the table

| Variable | What it moves |
| :-- | :-- |
| Registered voters | The base electorate per county or constituency |
| Turnout by cohort | Which registered voters actually cast a ballot |
| Bloc swing | Shift in vote share for a region or demographic bloc |
| Coalition configuration | Which players contest together |
| Third-party entry | Vote splitting and spoiler effects |
| Incumbency effect | Advantage or penalty attached to holding office |
| Regional elasticity | How strongly a national swing translates locally |
| Turnout shock | Late mobilisation or suppression events |

## What comes out

- Projected vote and seat shares with uncertainty intervals, never a bare number.
- A stability read on each coalition: who benefits, who is carrying it, and who would defect.
- Tipping points, meaning the smallest change in a given variable that flips the outcome.
- A sensitivity ranking so the reader knows which assumption the result actually rests on.
- An exportable scenario, so a claim can be shared together with the inputs behind it.

## Guardrails

The engine works only on published aggregate data. It holds no voter files, performs no individual profiling and offers no microtargeting. Every output is traceable to the inputs that produced it, runs are seeded so a shared scenario reproduces exactly, and the method is published alongside the tool. An election model that cannot show its working is not worth publishing.

## Architecture, as planned

The engine runs in the browser. There are no accounts and no server holding anyone's scenario. Simulation runs in a worker so the interface stays responsive during long runs, the same lesson RepoBundle learned about yielding during heavy processing. Scenarios travel in the URL, so sharing a projection means sharing its assumptions.

A scenario is a small, readable object:

```json
{
  "name": "Baseline",
  "seed": 20261114,
  "turnout": { "national": 0.62, "cohort_adjust": {} },
  "bloc_swing": { "region_a": 0.03 },
  "coalitions": [["party_a", "party_b"], ["party_c"]],
  "shocks": []
}
