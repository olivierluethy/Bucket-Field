# Bucket-Field
Select field and try to find all of the enemy

Ein Feld so gross wie ein Schiff versenken Spiel.
Der Gegner wählt auf der rechten Seite 10 Felder und der Spieler auf der linken Seiten aus.

Danach müssen der Gegner und der Spieler so schnell wie möglich alle 10 ausgewählten Felder finden.
Der Spieler welcher alle 10 findet gewinnt das Spiel.

## Funktion
Das ganze funktioniert so, dass die Felder via Schleife in JavaScript erzeugt werden. Mittels der Zufälligkeitsfunktion werden die Felder vom Bot Zufällig ausgewählt. Das nachdem der Spieler seine 10 gefunden hat.

Hat der Spieler 10 Felder ausgesucht, wird sein Feld blockiert und muss dann auf dem rechten Feld die ausgewählten Felder des Botes finden. Gleichzeitig sieht er, welche Versuche der Bot tätigt um zu gewinnen.
