% Evidence-grounded intelligence rules.

belongs_to(Concept, Domain) :- is_a(Concept, Domain).
belongs_to(Concept, Domain) :- part_of(Concept, Domain).
belongs_to(Concept, Domain) :- is_a(Concept, Mid), belongs_to(Mid, Domain).
belongs_to(Concept, Domain) :- part_of(Concept, Mid), belongs_to(Mid, Domain).

computer_vision_paper(Paper) :- method(Paper, Method), belongs_to(Method, computer_vision).
nlp_paper(Paper) :- method(Paper, Method), belongs_to(Method, nlp).
ml_paper(Paper) :- method(Paper, Method), belongs_to(Method, ml).
systems_paper(Paper) :- method(Paper, Method), belongs_to(Method, systems).
software_engineering_paper(Paper) :- method(Paper, Method), belongs_to(Method, software_engineering).

high_accuracy(Paper) :- accuracy(Paper, A), A > 95.
moderate_accuracy(Paper) :- accuracy(Paper, A), A > 80, A =< 95.
low_accuracy(Paper) :- accuracy(Paper, A), A =< 80.

outperforms(P1, P2) :- accuracy(P1, A1), accuracy(P2, A2), A1 > A2.
same_dataset(P1, P2) :- dataset(P1, D), dataset(P2, D), P1 \= P2.
same_domain(P1, P2) :-
  method(P1, M1), method(P2, M2),
  belongs_to(M1, D), belongs_to(M2, D),
  P1 \= P2.

recommended_baseline(Paper, Baseline) :- method(Paper, Method), related_to(Method, Baseline).

% Generic facts used by quiz/chat generation. Accuracy is emitted only when
% the evidence explicitly names accuracy; correlation never becomes accuracy.
key_fact(Paper, method, Method) :- method(Paper, Method).
key_fact(Paper, dataset, Dataset) :- dataset(Paper, Dataset).
key_fact(Paper, accuracy, Acc) :- accuracy(Paper, Acc).
key_fact(Paper, domain, Domain) :- method(Paper, M), belongs_to(M, Domain).
key_fact(Paper, task, Task) :- solves(Paper, Task).
key_fact(Paper, tool, Tool) :- tool(Paper, Tool).
key_fact(Paper, sample, Sample) :- sample(Paper, Sample, _).
key_fact(Paper, result, Result) :- result(Paper, Result, _, _).
key_fact(Paper, problem, Problem) :- problem(Paper, Problem).

explains_domain(Paper, Method, Domain) :- method(Paper, Method), is_a(Method, Domain).

has_direct_evidence(Paper) :- claim(Paper, _, _).
